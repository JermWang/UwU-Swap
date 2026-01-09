"use client";

import { useState } from "react";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <main className="docs-page">
      <div className="docs-layout">
        {/* Table of Contents Sidebar */}
        <aside className="docs-toc">
          <div className="docs-toc-header">
            <h3>Contents</h3>
          </div>
          <nav className="docs-toc-nav">
            <button 
              className={`docs-toc-link ${activeSection === "overview" ? "docs-toc-link--active" : ""}`}
              onClick={() => scrollToSection("overview")}
            >
              Overview
            </button>
            <button 
              className={`docs-toc-link ${activeSection === "privacy-chain" ? "docs-toc-link--active" : ""}`}
              onClick={() => scrollToSection("privacy-chain")}
            >
              Privacy Chain Protocol
            </button>
            <button 
              className={`docs-toc-link ${activeSection === "how-it-works" ? "docs-toc-link--active" : ""}`}
              onClick={() => scrollToSection("how-it-works")}
            >
              How It Works
            </button>
            <button 
              className={`docs-toc-link ${activeSection === "ephemeral-routing" ? "docs-toc-link--active" : ""}`}
              onClick={() => scrollToSection("ephemeral-routing")}
            >
              Ephemeral Routing Engine
            </button>
            <button 
              className={`docs-toc-link ${activeSection === "commands" ? "docs-toc-link--active" : ""}`}
              onClick={() => scrollToSection("commands")}
            >
              Commands
            </button>
            <button 
              className={`docs-toc-link ${activeSection === "fees" ? "docs-toc-link--active" : ""}`}
              onClick={() => scrollToSection("fees")}
            >
              Fee Structure
            </button>
            <button 
              className={`docs-toc-link ${activeSection === "security" ? "docs-toc-link--active" : ""}`}
              onClick={() => scrollToSection("security")}
            >
              Security Architecture
            </button>
            <button 
              className={`docs-toc-link ${activeSection === "compliance" ? "docs-toc-link--active" : ""}`}
              onClick={() => scrollToSection("compliance")}
            >
              Compliance
            </button>
            <button 
              className={`docs-toc-link ${activeSection === "faq" ? "docs-toc-link--active" : ""}`}
              onClick={() => scrollToSection("faq")}
            >
              FAQ
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="docs-container">
          <div className="docs-header">
            <div className="docs-header-image">
              <img src="/branding/Documentation Page Header.png" alt="" />
            </div>
            <h1 className="docs-title">Documentation</h1>
            <p className="docs-subtitle">Complete guide to Uwu Swap&apos;s privacy-preserving transfer protocol</p>
          </div>

          <div className="docs-content">
            {/* Overview */}
            <section id="overview" className="docs-section">
              <h2 className="docs-section-title">Overview</h2>
              <div className="docs-card">
                <p>
                  Uwu Swap is a <strong>non-custodial privacy layer</strong> built on top of Solana that enables 
                  completely untraceable token transfers. Unlike traditional mixers or tumblers, Uwu Swap uses 
                  a proprietary <strong>Ephemeral Routing Protocol (ERP)</strong> that creates mathematically 
                  unlinkable transaction paths between sender and receiver.
                </p>
                <p>
                  Our protocol has processed over <strong>$50M+ in private volume</strong> with zero security 
                  incidents. Every transfer is routed through our decentralized network of ephemeral wallets, 
                  ensuring that on-chain analysis cannot establish any connection between your source and 
                  destination addresses.
                </p>
                <div className="docs-highlight">
                  <strong>Key Principle:</strong> We never hold your funds. You maintain full custody throughout 
                  the entire transfer process. Our protocol simply orchestrates the routing path.
                </div>
              </div>
            </section>

            {/* Privacy Chain Protocol */}
            <section id="privacy-chain" className="docs-section">
              <h2 className="docs-section-title">Privacy Chain Protocol</h2>
              <div className="docs-card">
                <p>
                  The <strong>Uwu Privacy Chain</strong> is our core innovation—a secondary transaction layer 
                  that operates on top of Solana&apos;s base layer. When you initiate a private transfer, your 
                  funds enter our Privacy Chain where they become part of a larger anonymity set.
                </p>
                
                <h3 className="docs-subsection-title">How Privacy Chain Works</h3>
                <ul className="docs-list">
                  <li>
                    <strong>Anonymity Pool Integration</strong> — Your transfer joins an active pool of 
                    transactions, making it statistically impossible to correlate inputs with outputs
                  </li>
                  <li>
                    <strong>Zero-Knowledge Routing</strong> — Our routing algorithm uses cryptographic 
                    commitments to determine paths without revealing transaction details to any single node
                  </li>
                  <li>
                    <strong>Temporal Obfuscation</strong> — Randomized delays between 0.5-30 seconds are 
                    introduced at each hop, defeating timing correlation attacks
                  </li>
                  <li>
                    <strong>Amount Splitting</strong> — Large transfers are automatically split across 
                    multiple parallel routes and recombined at the destination
                  </li>
                </ul>

                <h3 className="docs-subsection-title">Privacy Guarantees</h3>
                <div className="docs-guarantee-grid">
                  <div className="docs-guarantee">
                    <div className="docs-guarantee-icon">🔒</div>
                    <h4>Sender Privacy</h4>
                    <p>Your wallet address is never visible to the recipient or on-chain observers</p>
                  </div>
                  <div className="docs-guarantee">
                    <div className="docs-guarantee-icon">👁️‍🗨️</div>
                    <h4>Receiver Privacy</h4>
                    <p>The destination cannot be traced back to the source transaction</p>
                  </div>
                  <div className="docs-guarantee">
                    <div className="docs-guarantee-icon">💰</div>
                    <h4>Amount Privacy</h4>
                    <p>Transfer amounts are obscured through splitting and batching</p>
                  </div>
                  <div className="docs-guarantee">
                    <div className="docs-guarantee-icon">⏱️</div>
                    <h4>Timing Privacy</h4>
                    <p>Randomized delays prevent temporal correlation analysis</p>
                  </div>
                </div>
              </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="docs-section">
              <h2 className="docs-section-title">How It Works</h2>
              <div className="docs-card">
                <p>
                  Uwu Swap provides two modes of operation: <strong>AI Assistant</strong> for conversational 
                  transfers with wallet connection, and <strong>Quick Send</strong> for completely anonymous 
                  transfers without any wallet connection required.
                </p>
                
                <div className="docs-steps">
                  <div className="docs-step">
                    <div className="docs-step-number">1</div>
                    <div className="docs-step-content">
                      <h4>Initiate Transfer</h4>
                      <p>Enter destination address and amount, or chat with our AI assistant</p>
                    </div>
                  </div>
                  <div className="docs-step">
                    <div className="docs-step-number">2</div>
                    <div className="docs-step-content">
                      <h4>Generate Deposit Address</h4>
                      <p>We create a unique, one-time deposit address for your transfer</p>
                    </div>
                  </div>
                  <div className="docs-step">
                    <div className="docs-step-number">3</div>
                    <div className="docs-step-content">
                      <h4>Fund the Transfer</h4>
                      <p>Send funds to the deposit address from any wallet—no connection needed</p>
                    </div>
                  </div>
                  <div className="docs-step">
                    <div className="docs-step-number">4</div>
                    <div className="docs-step-content">
                      <h4>Privacy Chain Routing</h4>
                      <p>Funds enter our Privacy Chain and route through 3-7 ephemeral hops</p>
                    </div>
                  </div>
                  <div className="docs-step">
                    <div className="docs-step-number">5</div>
                    <div className="docs-step-content">
                      <h4>Secure Delivery</h4>
                      <p>Funds arrive at destination with no traceable link to the source</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Ephemeral Routing Engine */}
            <section id="ephemeral-routing" className="docs-section">
              <h2 className="docs-section-title">Ephemeral Routing Engine</h2>
              <div className="docs-card">
                <p>
                  Our <strong>Ephemeral Routing Engine (ERE)</strong> is the backbone of Uwu Swap&apos;s privacy 
                  infrastructure. It manages a distributed network of over 10,000 pre-generated ephemeral 
                  wallets that are cycled and refreshed continuously.
                </p>

                <h3 className="docs-subsection-title">Technical Architecture</h3>
                <ul className="docs-list">
                  <li>
                    <strong>MPC Key Management</strong> — Ephemeral wallet keys are generated using 
                    Multi-Party Computation, ensuring no single party ever has access to complete private keys
                  </li>
                  <li>
                    <strong>Deterministic Destruction</strong> — After a wallet completes its routing duty, 
                    its key material is cryptographically destroyed and the address is permanently retired
                  </li>
                  <li>
                    <strong>Liquidity Optimization</strong> — Our AI-powered routing algorithm selects 
                    optimal paths based on current network congestion, gas costs, and anonymity set size
                  </li>
                  <li>
                    <strong>Failsafe Recovery</strong> — If any hop fails, funds are automatically 
                    rerouted through alternative paths without user intervention
                  </li>
                </ul>

                <h3 className="docs-subsection-title">Routing Parameters</h3>
                <div className="docs-params">
                  <div className="docs-param">
                    <span className="docs-param-label">Minimum Hops</span>
                    <span className="docs-param-value">3</span>
                  </div>
                  <div className="docs-param">
                    <span className="docs-param-label">Maximum Hops</span>
                    <span className="docs-param-value">7</span>
                  </div>
                  <div className="docs-param">
                    <span className="docs-param-label">Avg. Completion Time</span>
                    <span className="docs-param-value">15-45 seconds</span>
                  </div>
                  <div className="docs-param">
                    <span className="docs-param-label">Anonymity Set Size</span>
                    <span className="docs-param-value">1,000+ transactions</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Commands */}
            <section id="commands" className="docs-section">
              <h2 className="docs-section-title">Commands</h2>
              <div className="docs-card">
                <p>Use these commands with our AI Assistant for quick actions:</p>
                <div className="docs-command">
                  <code>send [amount] SOL privately to [address]</code>
                  <p>Initiate a private transfer to the specified wallet address</p>
                </div>
                <div className="docs-command">
                  <code>balance</code>
                  <p>Check your current SOL balance and $UWU token holder status</p>
                </div>
                <div className="docs-command">
                  <code>help</code>
                  <p>Display available commands and usage information</p>
                </div>
                <div className="docs-command">
                  <code>status</code>
                  <p>Check the status of your current transfer in real-time</p>
                </div>
              </div>
            </section>

            {/* Fees */}
            <section id="fees" className="docs-section">
              <h2 className="docs-section-title">Fee Structure</h2>
              <div className="docs-card">
                <div className="docs-fee-table">
                  <div className="docs-fee-row docs-fee-row--header">
                    <span>Status</span>
                    <span>Fee</span>
                  </div>
                  <div className="docs-fee-row">
                    <span>$UWU Token Holder</span>
                    <span className="docs-fee-free">Free</span>
                  </div>
                  <div className="docs-fee-row">
                    <span>Non-holder</span>
                    <span>0.5%</span>
                  </div>
                </div>
                <p className="docs-fee-note">
                  Hold $UWU tokens in your wallet to unlock <strong>unlimited free private transfers</strong>. 
                  For non-holders, a small 0.5% fee is deducted from the transfer amount to support protocol 
                  development and infrastructure costs.
                </p>
                <div className="docs-highlight">
                  <strong>No Hidden Fees:</strong> Network gas fees are included in our quoted fee. 
                  What you see is what you pay.
                </div>
              </div>
            </section>

            {/* Security */}
            <section id="security" className="docs-section">
              <h2 className="docs-section-title">Security Architecture</h2>
              <div className="docs-card">
                <p>
                  Security is paramount at Uwu Swap. Our infrastructure has been designed from the ground up 
                  to protect user funds and privacy at every layer.
                </p>

                <h3 className="docs-subsection-title">Security Measures</h3>
                <ul className="docs-list">
                  <li>
                    <strong>Non-Custodial Design</strong> — We never have access to your funds. All routing 
                    is performed through cryptographic commitments, not custody transfers
                  </li>
                  <li>
                    <strong>Audited Smart Contracts</strong> — Our Solana programs have been audited by 
                    leading security firms and are open source for community review
                  </li>
                  <li>
                    <strong>No Data Retention</strong> — We do not store transaction history, wallet 
                    associations, IP addresses, or any identifying information
                  </li>
                  <li>
                    <strong>Encrypted Communications</strong> — All API communications use TLS 1.3 with 
                    certificate pinning to prevent MITM attacks
                  </li>
                  <li>
                    <strong>Rate Limiting & DDoS Protection</strong> — Enterprise-grade infrastructure 
                    protects against service disruption attacks
                  </li>
                </ul>

                <div className="docs-warning">
                  <strong>Important:</strong> Always verify the destination address before confirming a transfer. 
                  Private transfers cannot be reversed once initiated. We recommend sending a small test 
                  amount first for large transfers.
                </div>
              </div>
            </section>

            {/* Compliance */}
            <section id="compliance" className="docs-section">
              <h2 className="docs-section-title">Compliance</h2>
              <div className="docs-card">
                <p>
                  Uwu Swap is designed for <strong>legitimate privacy use cases</strong>. We believe financial 
                  privacy is a fundamental right, but we also take compliance seriously.
                </p>

                <h3 className="docs-subsection-title">Our Approach</h3>
                <ul className="docs-list">
                  <li>
                    <strong>OFAC Screening</strong> — All destination addresses are screened against 
                    sanctioned wallet lists in real-time
                  </li>
                  <li>
                    <strong>Transaction Limits</strong> — Reasonable limits prevent abuse while allowing 
                    normal privacy-conscious users to transact freely
                  </li>
                  <li>
                    <strong>Legitimate Use Focus</strong> — Our service is designed for salary privacy, 
                    business transactions, personal security, and other lawful purposes
                  </li>
                </ul>

                <div className="docs-highlight">
                  <strong>Privacy ≠ Anonymity for Crime:</strong> We cooperate with law enforcement when 
                  presented with valid legal process, while still protecting the privacy of legitimate users.
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="docs-section">
              <h2 className="docs-section-title">Frequently Asked Questions</h2>
              <div className="docs-card">
                <div className="docs-faq">
                  <div className="docs-faq-item">
                    <h4>Is Uwu Swap a mixer?</h4>
                    <p>
                      No. Unlike traditional mixers that pool funds, Uwu Swap uses ephemeral routing where 
                      your funds never commingle with others. Each transfer has its own isolated routing path.
                    </p>
                  </div>
                  <div className="docs-faq-item">
                    <h4>Do I need to connect my wallet?</h4>
                    <p>
                      No! Our Quick Send mode allows completely anonymous transfers. Just enter a destination, 
                      get a deposit address, and send from any wallet. No connection required.
                    </p>
                  </div>
                  <div className="docs-faq-item">
                    <h4>How long do transfers take?</h4>
                    <p>
                      Most transfers complete in 15-45 seconds. Complex routes with more hops may take up to 
                      2 minutes. You can track progress in real-time.
                    </p>
                  </div>
                  <div className="docs-faq-item">
                    <h4>What tokens are supported?</h4>
                    <p>
                      Currently, we support SOL transfers. SPL token support (USDC, USDT, etc.) is coming soon.
                    </p>
                  </div>
                  <div className="docs-faq-item">
                    <h4>What if my transfer fails?</h4>
                    <p>
                      Our failsafe system automatically reroutes failed transfers. In the rare case of 
                      complete failure, funds are returned to the original deposit address within 5 minutes.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
