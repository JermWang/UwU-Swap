"use client";

import { useState } from "react";

type AnimeWidgetSkinProps = {
  imageUrl?: string;
  fallbackGradient?: string;
  opacity?: number;
  children: React.ReactNode;
  className?: string;
};

/**
 * AnimeWidgetSkin - Wrapper component for adding Nano Banana Pro generated
 * anime/uwu-style image skins to widgets and cards.
 * 
 * Usage:
 * 1. Generate an anime-style image using Nano Banana Pro
 * 2. Pass the image URL to this component
 * 3. The image will be displayed as a subtle background overlay
 * 
 * Example prompts for Nano Banana Pro:
 * - "cyberpunk anime girl with neon green hair, dark background, futuristic"
 * - "kawaii anime character with circuit board patterns, green glow"
 * - "anime hacker girl with holographic displays, matrix style"
 */
export default function AnimeWidgetSkin({
  imageUrl,
  fallbackGradient = "linear-gradient(135deg, rgba(0, 255, 136, 0.05) 0%, rgba(0, 206, 209, 0.05) 100%)",
  opacity = 0.15,
  children,
  className = "",
}: AnimeWidgetSkinProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className={`widget-skin ${className}`} style={{ position: "relative" }}>
      {/* Background Image Layer */}
      {imageUrl && !imageError ? (
        <>
          <img
            src={imageUrl}
            alt=""
            className="widget-skin-image"
            style={{ opacity }}
            onError={() => setImageError(true)}
          />
          <div className="widget-skin-overlay" />
        </>
      ) : (
        <div
          className="widget-skin-fallback"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: fallbackGradient,
            pointerEvents: "none",
            borderRadius: "inherit",
          }}
        />
      )}
      
      {/* Content Layer */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * AnimeAvatar - Avatar component for displaying Nano Banana Pro generated
 * anime character avatars.
 */
export function AnimeAvatar({
  imageUrl,
  size = 32,
  fallbackIcon,
  className = "",
}: {
  imageUrl?: string;
  size?: number;
  fallbackIcon?: React.ReactNode;
  className?: string;
}) {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className={`anime-avatar ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: "linear-gradient(135deg, #00FF88 0%, #00CED1 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        border: "1px solid rgba(0, 255, 136, 0.3)",
        flexShrink: 0,
      }}
    >
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt="Avatar"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          onError={() => setImageError(true)}
        />
      ) : (
        fallbackIcon || (
          <svg
            width={size * 0.5}
            height={size * 0.5}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0A0A0F"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        )
      )}
    </div>
  );
}

/**
 * WidgetSkinPlaceholder - Shows where to add Nano Banana Pro images
 * with instructions for the developer.
 */
export function WidgetSkinPlaceholder({
  prompt,
  width = "100%",
  height = 200,
}: {
  prompt: string;
  width?: string | number;
  height?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        background: "rgba(0, 255, 136, 0.05)",
        border: "1px dashed rgba(0, 255, 136, 0.3)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        gap: 12,
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(0, 255, 136, 0.5)"
        strokeWidth="1.5"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      <div
        style={{
          fontSize: 12,
          color: "rgba(0, 255, 136, 0.6)",
          textAlign: "center",
          maxWidth: 280,
        }}
      >
        <strong>Nano Banana Pro Image</strong>
        <br />
        <span style={{ fontSize: 11, color: "rgba(160, 160, 176, 0.8)" }}>
          Prompt: &quot;{prompt}&quot;
        </span>
      </div>
    </div>
  );
}
