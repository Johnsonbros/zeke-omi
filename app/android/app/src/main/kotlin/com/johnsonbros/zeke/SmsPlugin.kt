package com.johnsonbros.zeke

import android.Manifest
import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler
import io.flutter.plugin.common.MethodChannel.Result
import java.util.UUID

/**
 * Flutter plugin for sending SMS messages on Android.
 * Handles the platform channel "com.johnsonbros.zeke/sms"
 */
class SmsPlugin : FlutterPlugin, MethodCallHandler, ActivityAware {
    private lateinit var channel: MethodChannel
    private lateinit var context: Context
    private var activity: Activity? = null

    companion object {
        private const val CHANNEL_NAME = "com.johnsonbros.zeke/sms"
        private const val SMS_PERMISSION_REQUEST = 1001
        private const val SMS_SENT_ACTION = "com.johnsonbros.zeke.SMS_SENT"
        private const val SMS_DELIVERED_ACTION = "com.johnsonbros.zeke.SMS_DELIVERED"
    }

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        context = binding.applicationContext
        channel = MethodChannel(binding.binaryMessenger, CHANNEL_NAME)
        channel.setMethodCallHandler(this)
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel.setMethodCallHandler(null)
    }

    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        activity = binding.activity
    }

    override fun onDetachedFromActivityForConfigChanges() {
        activity = null
    }

    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
        activity = binding.activity
    }

    override fun onDetachedFromActivity() {
        activity = null
    }

    override fun onMethodCall(call: MethodCall, result: Result) {
        when (call.method) {
            "sendSms" -> {
                val to = call.argument<String>("to")
                val message = call.argument<String>("message")
                
                if (to.isNullOrBlank() || message.isNullOrBlank()) {
                    result.error("INVALID_ARGS", "Missing 'to' or 'message'", null)
                    return
                }
                
                sendSms(to, message, result)
            }
            "checkPermission" -> {
                val hasPermission = checkSmsPermission()
                result.success(hasPermission)
            }
            "requestPermission" -> {
                requestSmsPermission(result)
            }
            "isAvailable" -> {
                // Check if device has telephony capability
                val pm = context.packageManager
                val hasTelephony = pm.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)
                result.success(hasTelephony)
            }
            else -> {
                result.notImplemented()
            }
        }
    }

    private fun checkSmsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestSmsPermission(result: Result) {
        val currentActivity = activity
        if (currentActivity == null) {
            result.error("NO_ACTIVITY", "No activity available for permission request", null)
            return
        }

        if (checkSmsPermission()) {
            result.success(true)
            return
        }

        ActivityCompat.requestPermissions(
            currentActivity,
            arrayOf(Manifest.permission.SEND_SMS),
            SMS_PERMISSION_REQUEST
        )
        
        // Note: Result will be returned asynchronously via onRequestPermissionsResult
        // For simplicity, we return pending state
        result.success(false)
    }

    private fun sendSms(to: String, message: String, result: Result) {
        if (!checkSmsPermission()) {
            result.error("PERMISSION_DENIED", "SMS permission not granted", null)
            return
        }

        try {
            val messageId = UUID.randomUUID().toString()
            val smsManager = getSmsManager()

            // Create pending intents for sent and delivery confirmation
            val sentIntent = PendingIntent.getBroadcast(
                context,
                0,
                Intent(SMS_SENT_ACTION).apply { putExtra("messageId", messageId) },
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )

            val deliveredIntent = PendingIntent.getBroadcast(
                context,
                0,
                Intent(SMS_DELIVERED_ACTION).apply { putExtra("messageId", messageId) },
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )

            // Register receiver for sent confirmation
            val sentReceiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context?, intent: Intent?) {
                    context.unregisterReceiver(this)
                    
                    when (resultCode) {
                        Activity.RESULT_OK -> {
                            result.success(mapOf(
                                "success" to true,
                                "messageId" to messageId
                            ))
                        }
                        SmsManager.RESULT_ERROR_GENERIC_FAILURE -> {
                            result.success(mapOf(
                                "success" to false,
                                "error" to "Generic failure"
                            ))
                        }
                        SmsManager.RESULT_ERROR_NO_SERVICE -> {
                            result.success(mapOf(
                                "success" to false,
                                "error" to "No service"
                            ))
                        }
                        SmsManager.RESULT_ERROR_NULL_PDU -> {
                            result.success(mapOf(
                                "success" to false,
                                "error" to "Null PDU"
                            ))
                        }
                        SmsManager.RESULT_ERROR_RADIO_OFF -> {
                            result.success(mapOf(
                                "success" to false,
                                "error" to "Radio off"
                            ))
                        }
                        else -> {
                            result.success(mapOf(
                                "success" to false,
                                "error" to "Unknown error: $resultCode"
                            ))
                        }
                    }
                }
            }

            // Register the receiver
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(
                    sentReceiver,
                    IntentFilter(SMS_SENT_ACTION),
                    Context.RECEIVER_NOT_EXPORTED
                )
            } else {
                context.registerReceiver(sentReceiver, IntentFilter(SMS_SENT_ACTION))
            }

            // Handle long messages (split into parts)
            val parts = smsManager.divideMessage(message)
            
            if (parts.size == 1) {
                // Single part message
                smsManager.sendTextMessage(to, null, message, sentIntent, deliveredIntent)
            } else {
                // Multipart message
                val sentIntents = ArrayList<PendingIntent>()
                val deliveredIntents = ArrayList<PendingIntent>()
                
                for (i in parts.indices) {
                    sentIntents.add(sentIntent)
                    deliveredIntents.add(deliveredIntent)
                }
                
                smsManager.sendMultipartTextMessage(
                    to,
                    null,
                    parts,
                    sentIntents,
                    deliveredIntents
                )
            }

        } catch (e: Exception) {
            result.success(mapOf(
                "success" to false,
                "error" to (e.message ?: "Unknown error")
            ))
        }
    }

    @Suppress("DEPRECATION")
    private fun getSmsManager(): SmsManager {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(SmsManager::class.java)
        } else {
            SmsManager.getDefault()
        }
    }
}
