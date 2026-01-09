"use client";

export default function Footer() {
  return (
    <footer className="swap-footer">
      <div className="swap-footer-inner">
        <div className="swap-footer-content">
          <div className="swap-footer-brand">
            <img src="/branding/AI_assistant_avatar.png" alt="Uwu Swap" className="swap-footer-logo" />
            <div className="swap-footer-brand-text">
              <span className="swap-footer-name">Uwu Swap</span>
              <span className="swap-footer-tagline">Privacy-first transfers on Solana</span>
            </div>
          </div>
          
          <div className="swap-footer-links">
            <div className="swap-footer-section">
              <h4>Product</h4>
              <a href="/">Swap</a>
              <a href="/docs">Documentation</a>
            </div>
            <div className="swap-footer-section">
              <h4>Community</h4>
              <a href="https://x.com/uwuswap_" target="_blank" rel="noopener noreferrer">Twitter</a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer">Discord</a>
            </div>
            <div className="swap-footer-section">
              <h4>Legal</h4>
              <a href="/docs">Terms of Service</a>
              <a href="/docs">Privacy Policy</a>
            </div>
          </div>
        </div>
        
        <div className="swap-footer-bottom">
          <span>© 2025 Uwu Swap. All rights reserved.</span>
          <span className="swap-footer-built">Built on Solana</span>
        </div>
      </div>
    </footer>
  );
}
