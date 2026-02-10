package com.johnsonbros.zeke

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.view.WindowManager
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler
import io.flutter.plugin.common.MethodChannel.Result
import io.flutter.plugin.common.PluginRegistry
import java.io.File

/**
 * Flutter plugin for screen recording on Android.
 * Handles the platform channel "com.johnsonbros.zeke/screen"
 */
class ScreenRecordPlugin : FlutterPlugin, MethodCallHandler, ActivityAware, 
    PluginRegistry.ActivityResultListener {
    
    private lateinit var channel: MethodChannel
    private lateinit var context: Context
    private var activity: Activity? = null
    private var activityBinding: ActivityPluginBinding? = null

    private var mediaProjectionManager: MediaProjectionManager? = null
    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var mediaRecorder: MediaRecorder? = null
    
    private var pendingResult: Result? = null
    private var outputPath: String? = null
    private var screenWidth: Int = 0
    private var screenHeight: Int = 0
    private var screenDensity: Int = 0
    private var isRecording = false

    companion object {
        private const val CHANNEL_NAME = "com.johnsonbros.zeke/screen"
        private const val SCREEN_CAPTURE_REQUEST = 1002
    }

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        context = binding.applicationContext
        channel = MethodChannel(binding.binaryMessenger, CHANNEL_NAME)
        channel.setMethodCallHandler(this)
        
        mediaProjectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) 
            as MediaProjectionManager
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel.setMethodCallHandler(null)
        stopRecording()
    }

    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        activity = binding.activity
        activityBinding = binding
        binding.addActivityResultListener(this)
        
        // Get screen metrics
        val windowManager = activity?.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        windowManager.defaultDisplay.getMetrics(metrics)
        screenWidth = metrics.widthPixels
        screenHeight = metrics.heightPixels
        screenDensity = metrics.densityDpi
    }

    override fun onDetachedFromActivityForConfigChanges() {
        activityBinding?.removeActivityResultListener(this)
        activity = null
        activityBinding = null
    }

    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
        activity = binding.activity
        activityBinding = binding
        binding.addActivityResultListener(this)
    }

    override fun onDetachedFromActivity() {
        activityBinding?.removeActivityResultListener(this)
        activity = null
        activityBinding = null
    }

    override fun onMethodCall(call: MethodCall, result: Result) {
        when (call.method) {
            "checkPermission" -> {
                // Screen recording permission is checked via activity result
                // We can't really "check" it, just request it
                result.success(false)
            }
            "requestPermission" -> {
                requestScreenCapturePermission(result)
            }
            "startRecording" -> {
                val path = call.argument<String>("outputPath")
                val durationMs = call.argument<Int>("durationMs") ?: 10000
                val fps = call.argument<Int>("fps") ?: 30
                val includeAudio = call.argument<Boolean>("includeAudio") ?: false
                
                if (path == null) {
                    result.error("INVALID_ARGS", "Missing outputPath", null)
                    return
                }
                
                outputPath = path
                startRecording(path, durationMs, fps, includeAudio, result)
            }
            "stopRecording" -> {
                stopRecording()
                result.success(mapOf(
                    "success" to true,
                    "width" to screenWidth,
                    "height" to screenHeight
                ))
            }
            "isRecording" -> {
                result.success(isRecording)
            }
            else -> {
                result.notImplemented()
            }
        }
    }

    private fun requestScreenCapturePermission(result: Result) {
        val currentActivity = activity
        if (currentActivity == null) {
            result.error("NO_ACTIVITY", "No activity available", null)
            return
        }

        pendingResult = result
        val intent = mediaProjectionManager?.createScreenCaptureIntent()
        currentActivity.startActivityForResult(intent, SCREEN_CAPTURE_REQUEST)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != SCREEN_CAPTURE_REQUEST) {
            return false
        }

        val result = pendingResult
        pendingResult = null

        if (resultCode == Activity.RESULT_OK && data != null) {
            mediaProjection = mediaProjectionManager?.getMediaProjection(resultCode, data)
            result?.success(true)
        } else {
            result?.success(false)
        }

        return true
    }

    private fun startRecording(
        path: String,
        durationMs: Int,
        fps: Int,
        includeAudio: Boolean,
        result: Result
    ) {
        if (isRecording) {
            result.error("ALREADY_RECORDING", "Already recording", null)
            return
        }

        if (mediaProjection == null) {
            // Need to request permission first
            pendingResult = result
            requestScreenCapturePermission(object : Result {
                override fun success(res: Any?) {
                    if (res == true) {
                        doStartRecording(path, durationMs, fps, includeAudio, result)
                    } else {
                        result.error("PERMISSION_DENIED", "Screen capture permission denied", null)
                    }
                }
                override fun error(code: String, msg: String?, details: Any?) {
                    result.error(code, msg, details)
                }
                override fun notImplemented() {
                    result.notImplemented()
                }
            })
            return
        }

        doStartRecording(path, durationMs, fps, includeAudio, result)
    }

    private fun doStartRecording(
        path: String,
        durationMs: Int,
        fps: Int,
        includeAudio: Boolean,
        result: Result
    ) {
        try {
            // Ensure output directory exists
            val file = File(path)
            file.parentFile?.mkdirs()

            // Setup MediaRecorder
            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            mediaRecorder?.apply {
                setVideoSource(MediaRecorder.VideoSource.SURFACE)
                if (includeAudio) {
                    setAudioSource(MediaRecorder.AudioSource.MIC)
                }
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                if (includeAudio) {
                    setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                }
                setVideoSize(screenWidth, screenHeight)
                setVideoFrameRate(fps)
                setVideoEncodingBitRate(5 * 1024 * 1024) // 5 Mbps
                setOutputFile(path)
                prepare()
            }

            // Create virtual display
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "ScreenCapture",
                screenWidth,
                screenHeight,
                screenDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                mediaRecorder?.surface,
                null,
                null
            )

            // Start recording
            mediaRecorder?.start()
            isRecording = true

            result.success(mapOf("success" to true))

            // Auto-stop after duration
            Handler(Looper.getMainLooper()).postDelayed({
                if (isRecording) {
                    stopRecording()
                }
            }, durationMs.toLong())

        } catch (e: Exception) {
            result.success(mapOf(
                "success" to false,
                "error" to (e.message ?: "Unknown error")
            ))
        }
    }

    private fun stopRecording() {
        if (!isRecording) return

        try {
            mediaRecorder?.stop()
            mediaRecorder?.reset()
            mediaRecorder?.release()
            mediaRecorder = null

            virtualDisplay?.release()
            virtualDisplay = null

            // Don't release mediaProjection - keep it for next recording
        } catch (e: Exception) {
            // Ignore errors during cleanup
        }

        isRecording = false
    }
}
