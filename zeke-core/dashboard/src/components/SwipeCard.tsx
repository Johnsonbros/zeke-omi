import { useState, useRef, useEffect } from 'react';
import { Check, X, Brain, Tag, Calendar, AlertTriangle } from 'lucide-react';
import type { Memory } from '../lib/api';

interface SwipeCardProps {
  memory: Memory;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  isTop: boolean;
}

export function SwipeCard({ memory, onSwipeLeft, onSwipeRight, isTop }: SwipeCardProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 100;
  const MAX_ROTATION = 15;

  const handleStart = (clientX: number, clientY: number) => {
    if (!isTop) return;
    setIsDragging(true);
    setStartPos({ x: clientX, y: clientY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !isTop) return;
    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;
    setPosition({ x: deltaX, y: deltaY * 0.3 });
    setRotation((deltaX / window.innerWidth) * MAX_ROTATION);
  };

  const handleEnd = () => {
    if (!isDragging || !isTop) return;
    setIsDragging(false);

    if (position.x < -SWIPE_THRESHOLD) {
      animateOut('left');
    } else if (position.x > SWIPE_THRESHOLD) {
      animateOut('right');
    } else {
      setPosition({ x: 0, y: 0 });
      setRotation(0);
    }
  };

  const animateOut = (direction: 'left' | 'right') => {
    const targetX = direction === 'left' ? -window.innerWidth : window.innerWidth;
    setPosition({ x: targetX, y: position.y });
    setRotation(direction === 'left' ? -MAX_ROTATION : MAX_ROTATION);
    
    setTimeout(() => {
      if (direction === 'left') {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    }, 200);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseUp = () => handleEnd();
    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging, position]);

  const swipeProgress = Math.min(Math.abs(position.x) / SWIPE_THRESHOLD, 1);
  const isSwipingLeft = position.x < 0;
  const isSwipingRight = position.x > 0;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      relationships: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      hobbies: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      preferences: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      health: 'bg-green-500/20 text-green-400 border-green-500/30',
      work: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      facts: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      other: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };
    return colors[category?.toLowerCase() || 'other'] || colors.other;
  };

  return (
    <div
      ref={cardRef}
      className={`absolute inset-4 md:inset-8 select-none ${isTop ? 'cursor-grab active:cursor-grabbing z-10' : 'z-0'}`}
      style={{
        transform: `translateX(${position.x}px) translateY(${position.y}px) rotate(${rotation}deg)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    >
      <div className="relative h-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
        {isSwipingLeft && swipeProgress > 0 && (
          <div
            className="absolute inset-0 bg-gradient-to-r from-green-500/30 to-transparent rounded-3xl flex items-center justify-start pl-8 z-20 pointer-events-none"
            style={{ opacity: swipeProgress }}
          >
            <div className="bg-green-500 rounded-full p-4 shadow-lg shadow-green-500/50">
              <Check className="w-10 h-10 text-white" />
            </div>
          </div>
        )}
        
        {isSwipingRight && swipeProgress > 0 && (
          <div
            className="absolute inset-0 bg-gradient-to-l from-red-500/30 to-transparent rounded-3xl flex items-center justify-end pr-8 z-20 pointer-events-none"
            style={{ opacity: swipeProgress }}
          >
            <div className="bg-red-500 rounded-full p-4 shadow-lg shadow-red-500/50">
              <X className="w-10 h-10 text-white" />
            </div>
          </div>
        )}

        <div className="h-full flex flex-col p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-slate-400 text-sm font-medium">Memory Review</span>
            </div>
            {memory.curation_status === 'flagged' && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-orange-400 text-xs font-medium">Flagged</span>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <p className="text-xl md:text-2xl lg:text-3xl text-white font-medium leading-relaxed mb-8">
              {memory.content}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(memory.created_at)}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {memory.category && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${getCategoryColor(memory.category)}`}>
                  <Tag className="w-3.5 h-3.5" />
                  {memory.category}
                </span>
              )}
              {memory.tags?.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-slate-700/50 text-slate-300 rounded-full text-sm border border-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>

            {memory.curation_notes && (
              <p className="text-sm text-slate-500 italic">
                {memory.curation_notes}
              </p>
            )}
          </div>
        </div>

        {isTop && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900/90 to-transparent">
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={() => animateOut('left')}
                className="p-4 bg-green-500 hover:bg-green-400 rounded-full shadow-lg shadow-green-500/30 transition-all hover:scale-110 active:scale-95"
              >
                <Check className="w-8 h-8 text-white" />
              </button>
              <button
                onClick={() => animateOut('right')}
                className="p-4 bg-red-500 hover:bg-red-400 rounded-full shadow-lg shadow-red-500/30 transition-all hover:scale-110 active:scale-95"
              >
                <X className="w-8 h-8 text-white" />
              </button>
            </div>
            <p className="text-center text-slate-500 text-xs mt-3">
              Swipe left to save • Swipe right to remove
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
