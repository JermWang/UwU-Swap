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
                  privacy-oriented token transfers. Unlike basic direct sends, Uwu Swap uses an 
                  <strong>Ephemeral Routing Protocol (ERP)</strong> to route through short-lived burner wallets 
                  to make simple address-to-address traceability harder.
                </p>
                <p>
                  Uwu Swap focuses on practical on-chain privacy improvements (like multi-hop routing and timing 
                  jitter). It is not a guarantee of perfect anonymity, and privacy properties depend on how you 
                  use the protocol and the broader on-chain context.
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
                  funds enter our Privacy Chain where they route through ephemeral hops to reduce simple correlation.
                </p>
                
                <h3 className="docs-subsection-title">How Privacy Chain Works</h3>
                <ul className="docs-list">
                  <li>
                    <strong>Ephemeral Routing</strong> — Your transfer routes through short-lived burner wallets to help reduce simple input/output correlation
                  </li>
                  <li>
                    <strong>Multi-hop Routing</strong> — Funds route through a short chain of burner wallets to 
                    reduce direct address-to-address traceability
                  </li>
                  <li>
                    <strong>Temporal Obfuscation</strong> — Randomized delays between 0.5-3 seconds are 
                    introduced at each hop to help reduce simple timing correlation
                  </li>
                  <li>
                    <strong>Operational Safety</strong> — Routing is designed to be non-custodial and minimize 
                    the amount of sensitive data handled by the frontend
                  </li>
                </ul>

                <h3 className="docs-subsection-title">Privacy Guarantees</h3>
                <div className="docs-guarantee-grid">
                  <div className="docs-guarantee">
                    <div className="docs-guarantee-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                      </svg>
                    </div>
                    <h4>Sender Privacy</h4>
                    <p>Routing helps reduce direct sender-to-recipient linkability compared to a simple direct send</p>
                  </div>
                  <div className="docs-guarantee">
                    <div className="docs-guarantee-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </div>
                    <h4>Receiver Privacy</h4>
                    <p>Routing can make it harder to correlate a source transaction to a destination address, but on-chain activity is still public</p>
                  </div>
                  <div className="docs-guarantee">
                    <div className="docs-guarantee-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <ellipse cx="12" cy="7" rx="7" ry="3" />
                        <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
                        <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
                      </svg>
                    </div>
                    <h4>Amount Privacy</h4>
                    <p>Amounts are visible on-chain. Routing is focused on reducing linkability, not hiding amounts</p>
                  </div>
                  <div className="docs-guarantee">
                    <div className="docs-guarantee-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="13" r="8" />
                        <path d="M12 13l3-2" />
                        <path d="M9 2h6" />
                        <path d="M12 5V2" />
                      </svg>
                    </div>
                    <h4>Timing Privacy</h4>
                    <p>Randomized delays help reduce simple temporal correlation</p>
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
                  transfers with wallet connection, and <strong>Non-Custodial</strong> mode (coming soon).
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
                      <p>We generate a one-time deposit address and routing plan for your transfer</p>
                    </div>
                  </div>
                  <div className="docs-step">
                    <div className="docs-step-number">3</div>
                    <div className="docs-step-content">
                      <h4>Fund the Transfer</h4>
                      <p>You sign a funding transaction from your connected wallet to the deposit address</p>
                    </div>
                  </div>
                  <div className="docs-step">
                    <div className="docs-step-number">4</div>
                    <div className="docs-step-content">
                      <h4>Privacy Chain Routing</h4>
                      <p>Funds enter our Privacy Chain and route through 2-5 ephemeral hops</p>
                    </div>
                  </div>
                  <div className="docs-step">
                    <div className="docs-step-number">5</div>
                    <div className="docs-step-content">
                      <h4>Secure Delivery</h4>
                      <p>Funds arrive at the destination after passing through the configured routing hops</p>
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
                  infrastructure. It coordinates the creation and use of short-lived burner wallets that are 
                  used to route transfers through multiple hops.
                </p>

                <h3 className="docs-subsection-title">Technical Architecture</h3>
                <ul className="docs-list">
                  <li>
                    <strong>Managed Burner Wallets</strong> — Burner wallets are created and used for routing, 
                    with signing handled by a managed wallet provider (so private keys are not exposed to the browser).
                  </li>
                  <li>
                    <strong>Deterministic Destruction</strong> — After a wallet completes its routing duty, 
                    its key material is retired from active use and rotated out of circulation.
                  </li>
                  <li>
                    <strong>Routing Randomization</strong> — Routing parameters include randomized hop counts and timing jitter.
                  </li>
                  <li>
                    <strong>Step-Based Execution</strong> — Transfers execute as a series of steps with status tracking, so failures can be detected and handled.
                  </li>
                </ul>

                <h3 className="docs-subsection-title">Routing Parameters</h3>
                <div className="docs-params">
                  <div className="docs-param">
                    <span className="docs-param-label">Minimum Hops</span>
                    <span className="docs-param-value">2</span>
                  </div>
                  <div className="docs-param">
                    <span className="docs-param-label">Maximum Hops</span>
                    <span className="docs-param-value">5</span>
                  </div>
                  <div className="docs-param">
                    <span className="docs-param-label">Avg. Completion Time</span>
                    <span className="docs-param-value">Varies</span>
                  </div>
                  <div className="docs-param">
                    <span className="docs-param-label">Anonymity Set Size</span>
                    <span className="docs-param-value">Varies</span>
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
                  Hold $UWU tokens in your wallet to unlock <strong>free private transfers</strong>. 
                  For non-holders, a small 0.5% fee is deducted from the transfer amount to support protocol 
                  development and infrastructure costs.
                </p>
                <div className="docs-highlight">
                  <strong>Transparent Fees:</strong> Fees are shown in the UI. Network fees may apply when funding the transfer.
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
                    is performed through user-funded routing plans and server-side execution, not custody transfers
                  </li>
                  <li>
                    <strong>Defense-in-Depth</strong> — We validate inputs, use strict allowlists where possible, and design server routes to avoid secret exposure
                  </li>
                  <li>
                    <strong>Minimal Data</strong> — We store only what&apos;s needed to execute and track routing plans; on-chain transactions remain publicly visible
                  </li>
                  <li>
                    <strong>Encrypted Communications</strong> — All API communications use HTTPS
                  </li>
                  <li>
                    <strong>Operational Controls</strong> — Production deployments should use rate limiting and monitoring appropriate for your environment
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
                      each transfer uses its own isolated routing path rather than a shared pool.
                    </p>
                  </div>
                  <div className="docs-faq-item">
                    <h4>Do I need to connect my wallet?</h4>
                    <p>
                      For <strong>AI Assistant</strong> transfers, yes—you&apos;ll connect a wallet to sign the initial funding transaction. 
                      <strong>Non-Custodial</strong> mode (no wallet connect) is coming soon.
                    </p>
                  </div>
                  <div className="docs-faq-item">
                    <h4>How long do transfers take?</h4>
                    <p>
                      Transfer time varies based on hop count, network conditions, and confirmations.
                      You can track progress in real-time in the UI.
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
                      If a hop fails, the UI will show the current status. If you run into issues, try again later or reach out to support.
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
