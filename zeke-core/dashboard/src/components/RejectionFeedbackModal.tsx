import { useState } from 'react';
import { X, AlertTriangle, Lightbulb, HelpCircle, Copy, Trash2, Send } from 'lucide-react';
import type { Memory } from '../lib/api';

interface RejectionFeedbackModalProps {
  memory: Memory;
  onSubmit: (reason: string, shouldDelete: boolean, feedback: string) => void;
  onCancel: () => void;
}

const REJECTION_REASONS = [
  {
    id: 'incorrect',
    label: 'Incorrect information',
    icon: AlertTriangle,
    description: 'The memory contains factually wrong information',
  },
  {
    id: 'outdated',
    label: 'Outdated',
    icon: HelpCircle,
    description: 'This was true before but is no longer accurate',
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    icon: Copy,
    description: 'This memory is a duplicate of another one',
  },
  {
    id: 'irrelevant',
    label: 'Not relevant',
    icon: Trash2,
    description: "This isn't something I want Zeke to remember",
  },
  {
    id: 'misunderstood',
    label: 'Misunderstood context',
    icon: Lightbulb,
    description: 'Zeke misinterpreted what I meant',
  },
];

export function RejectionFeedbackModal({ memory, onSubmit, onCancel }: RejectionFeedbackModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [feedback, setFeedback] = useState('');
  const [shouldDelete, setShouldDelete] = useState(true);

  const handleSubmit = () => {
    if (!selectedReason) return;
    onSubmit(selectedReason, shouldDelete, feedback);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Why remove this memory?</h2>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <p className="text-sm text-slate-400 mb-2">Memory being removed:</p>
            <p className="text-white">{memory.content}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-slate-400 font-medium">Select a reason:</p>
            <div className="space-y-2">
              {REJECTION_REASONS.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason.id)}
                  className={`w-full flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${
                    selectedReason === reason.id
                      ? 'bg-red-500/10 border-red-500/50 text-white'
                      : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <reason.icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    selectedReason === reason.id ? 'text-red-400' : 'text-slate-500'
                  }`} />
                  <div>
                    <p className="font-medium">{reason.label}</p>
                    <p className="text-sm text-slate-500">{reason.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-slate-400 font-medium">
              What should Zeke learn from this? <span className="text-slate-500">(optional)</span>
            </p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Help Zeke understand what went wrong or what the correct information should be..."
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 min-h-[100px] text-sm resize-none transition-all placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <input
              type="checkbox"
              id="deleteMemory"
              checked={shouldDelete}
              onChange={(e) => setShouldDelete(e.target.checked)}
              className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500/20"
            />
            <label htmlFor="deleteMemory" className="text-sm text-slate-300 cursor-pointer">
              Permanently delete this memory
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-900 p-5 border-t border-slate-700 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedReason}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            Submit Feedback
          </button>
        </div>
      </div>
    </div>
  );
}
