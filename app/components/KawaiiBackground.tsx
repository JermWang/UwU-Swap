"use client";

import { useEffect, useState } from "react";

type FloatingElement = {
  id: number;
  emoji: string;
  left: number;
  top: number;
  delay: number;
  duration: number;
  size: number;
};

export default function KawaiiBackground() {
  const [elements, setElements] = useState<FloatingElement[]>([]);

  useEffect(() => {
    const emojis = ["💕", "💖", "🌸", "✨", "🎀", "💫", "🐰", "🌷", "💗", "⭐"];
    const newElements: FloatingElement[] = [];

    for (let i = 0; i < 15; i++) {
      newElements.push({
        id: i,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 4 + Math.random() * 4,
        size: 12 + Math.random() * 16,
      });
    }

    setElements(newElements);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Gradient overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 20% 80%, rgba(255, 182, 193, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(230, 230, 250, 0.4) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(152, 251, 152, 0.2) 0%, transparent 40%),
            radial-gradient(circle at 70% 70%, rgba(255, 218, 185, 0.25) 0%, transparent 45%)
          `
        }}
      />

      {/* Floating elements */}
      {elements.map((el) => (
        <div
          key={el.id}
          className="absolute animate-float opacity-40"
          style={{
            left: `${el.left}%`,
            top: `${el.top}%`,
            fontSize: `${el.size}px`,
            animationDelay: `${el.delay}s`,
            animationDuration: `${el.duration}s`,
          }}
        >
          {el.emoji}
        </div>
      ))}

      {/* Sparkle particles */}
      <div className="sparkle-container">
        {[...Array(8)].map((_, i) => (
          <div
            key={`sparkle-${i}`}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: `${10 + i * 12}%`,
              top: `${15 + (i % 3) * 30}%`,
              background: 'linear-gradient(135deg, #FFFACD 0%, #FFB6C1 100%)',
              boxShadow: '0 0 10px #FFFACD, 0 0 20px #FFB6C1',
              animation: `sparkleFloat ${3 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function StarryBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div 
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg, #FFF5F8 0%, #F0E6FF 50%, #E6F0FF 100%)
          `
        }}
      />
      
      {/* Twinkling stars */}
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute text-yellow-200"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            fontSize: `${8 + Math.random() * 8}px`,
            opacity: 0.6,
            animation: `twinkle ${2 + Math.random() * 2}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        >
          ✦
        </div>
      ))}

      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
