import { useState, useEffect } from 'react';
import { CheckCircle2, RefreshCw, Sparkles, ArrowLeft } from 'lucide-react';
import { SwipeCard } from './SwipeCard';
import { RejectionFeedbackModal } from './RejectionFeedbackModal';
import type { Memory } from '../lib/api';

interface SwipeCurationViewProps {
  memories: Memory[];
  onComplete: () => void;
  onBack: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string, feedback: string, permanent: boolean) => Promise<void>;
}

export function SwipeCurationView({ 
  memories: initialMemories, 
  onComplete, 
  onBack,
  onApprove,
  onReject 
}: SwipeCurationViewProps) {
  const [cardStack, setCardStack] = useState<Memory[]>(initialMemories);
  const [processedCount, setProcessedCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [removedCount, setRemovedCount] = useState(0);
  const [pendingRejection, setPendingRejection] = useState<Memory | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setCardStack(initialMemories);
    setProcessedCount(0);
    setSavedCount(0);
    setRemovedCount(0);
  }, [initialMemories]);

  const handleSwipeLeft = async () => {
    if (cardStack.length === 0 || isProcessing) return;
    
    const topCard = cardStack[0];
    setIsProcessing(true);
    
    try {
      await onApprove(topCard.id);
      setSavedCount(prev => prev + 1);
      setProcessedCount(prev => prev + 1);
      setCardStack(prev => prev.slice(1));
    } catch (err) {
      console.error('Failed to approve memory:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwipeRight = () => {
    if (cardStack.length === 0 || isProcessing) return;
    setPendingRejection(cardStack[0]);
  };

  const handleRejectionSubmit = async (reason: string, shouldDelete: boolean, feedback: string) => {
    if (!pendingRejection) return;
    
    setIsProcessing(true);
    try {
      await onReject(pendingRejection.id, reason, feedback, shouldDelete);
      setRemovedCount(prev => prev + 1);
      setProcessedCount(prev => prev + 1);
      setCardStack(prev => prev.slice(1));
    } catch (err) {
      console.error('Failed to reject memory:', err);
    } finally {
      setIsProcessing(false);
      setPendingRejection(null);
    }
  };

  const handleRejectionCancel = () => {
    setPendingRejection(null);
  };

  const totalMemories = initialMemories.length;
  const progress = totalMemories > 0 ? (processedCount / totalMemories) * 100 : 0;

  if (cardStack.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/30">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">All Done!</h2>
        <p className="text-slate-400 mb-2">
          You reviewed {totalMemories} {totalMemories === 1 ? 'memory' : 'memories'}
        </p>
        <div className="flex items-center gap-6 text-sm mb-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-slate-400">{savedCount} saved</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-slate-400">{removedCount} removed</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors font-medium flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={onComplete}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all font-medium flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Load More
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <button
          onClick={onBack}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <span className="text-white font-medium">Memory Curation</span>
        </div>
        
        <div className="text-sm text-slate-400">
          {processedCount}/{totalMemories}
        </div>
      </div>

      <div className="px-4 py-2">
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>{savedCount} saved</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>{removedCount} removed</span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        {cardStack.slice(0, 3).map((memory, index) => (
          <SwipeCard
            key={memory.id}
            memory={memory}
            isTop={index === 0}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
          />
        ))}
      </div>

      {pendingRejection && (
        <RejectionFeedbackModal
          memory={pendingRejection}
          onSubmit={handleRejectionSubmit}
          onCancel={handleRejectionCancel}
        />
      )}
    </div>
  );
}
