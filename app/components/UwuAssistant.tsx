"use client";

import { useState } from "react";

type UwuAssistantProps = {
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
};

export default function UwuAssistant({ imageUrl, size = "md", animated = true }: UwuAssistantProps) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: "w-12 h-12 text-2xl",
    md: "w-20 h-20 text-4xl",
    lg: "w-32 h-32 text-6xl",
  };

  const animationClass = animated ? "animate-float" : "";

  return (
    <div className={`uwuAssistantAvatar ${sizeClasses[size]} ${animationClass}`}>
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt="Uwu Assistant"
          onError={() => setImageError(true)}
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <span className="select-none">🐰</span>
      )}
      <span className="absolute -top-1 -right-1 text-lg animate-sparkle">✨</span>
    </div>
  );
}

export function UwuMascot({ mood = "happy" }: { mood?: "happy" | "thinking" | "excited" | "sad" }) {
  const moodEmojis = {
    happy: "🐰",
    thinking: "🤔",
    excited: "🎉",
    sad: "😢",
  };

  const moodMessages = {
    happy: "Ready to help, senpai~!",
    thinking: "Hmm, let me think...",
    excited: "Yay! So exciting~!",
    sad: "Oh no...",
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="uwuAssistantAvatar w-24 h-24 text-5xl animate-float">
        <span className="select-none">{moodEmojis[mood]}</span>
      </div>
      <p className="text-sm text-text-secondary font-medium">{moodMessages[mood]}</p>
    </div>
  );
}
