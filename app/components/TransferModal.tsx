"use client";

import { useState } from "react";

export type TransferModalData = {
  amount: number;
  destination: string;
  resolvedAddress: string; // The actual pubkey (resolved from .sol if needed)
  hopCount: number;
  estimatedTimeMs: number;
  feeApplied: boolean;
  feeSol: number;
  planId: string;
  firstBurnerPubkey: string;
};

type TransferModalProps = {
  isOpen: boolean;
  data: TransferModalData | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
};

export default function TransferModal({ isOpen, data, onConfirm, onCancel, isLoading }: TransferModalProps) {
  if (!isOpen || !data) return null;

  const shortDest = data.destination.length > 20 
    ? `${data.destination.slice(0, 6)}...${data.destination.slice(-4)}`
    : data.destination;
  
  const shortResolved = `${data.resolvedAddress.slice(0, 6)}...${data.resolvedAddress.slice(-4)}`;
  const isSolDomain = data.destination.endsWith(".sol");
  const estimatedMinutes = Math.ceil(data.estimatedTimeMs / 60000);

  return (
    <div className="transfer-modal-overlay" onClick={onCancel}>
      <div className="transfer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="transfer-modal-header">
          <h2>Confirm Transfer</h2>
          <button className="transfer-modal-close" onClick={onCancel} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="transfer-modal-body">
          <div className="transfer-modal-amount">
            <span className="transfer-modal-amount-value">{data.amount}</span>
            <span className="transfer-modal-amount-unit">SOL</span>
          </div>

          <div className="transfer-modal-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </div>

          <div className="transfer-modal-destination">
            <label>Destination</label>
            {isSolDomain ? (
              <>
                <div className="transfer-modal-address transfer-modal-address--domain">
                  <span className="transfer-modal-domain">{data.destination}</span>
                </div>
                <div className="transfer-modal-resolved">
                  <span className="transfer-modal-resolved-label">Resolves to:</span>
                  <code>{shortResolved}</code>
                </div>
              </>
            ) : (
              <div className="transfer-modal-address">
                <code>{shortResolved}</code>
              </div>
            )}
          </div>

          <div className="transfer-modal-details">
            <div className="transfer-modal-detail">
              <span className="transfer-modal-detail-label">Privacy Hops</span>
              <span className="transfer-modal-detail-value">{data.hopCount}</span>
            </div>
            <div className="transfer-modal-detail">
              <span className="transfer-modal-detail-label">Est. Time</span>
              <span className="transfer-modal-detail-value">~{estimatedMinutes} min</span>
            </div>
            <div className="transfer-modal-detail">
              <span className="transfer-modal-detail-label">Fee</span>
              <span className={`transfer-modal-detail-value ${!data.feeApplied ? "transfer-modal-detail-value--free" : ""}`}>
                {data.feeApplied ? `${data.feeSol.toFixed(4)} SOL (0.5%)` : "Free"}
              </span>
            </div>
            {!data.feeApplied && (
              <div className="transfer-modal-badge">
                $UWU Holder Benefit
              </div>
            )}
          </div>

          <div className="transfer-modal-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span>Your tokens will route through {data.hopCount} privacy hops before delivery.</span>
          </div>
        </div>

        <div className="transfer-modal-footer">
          <button 
            className="transfer-modal-btn transfer-modal-btn--cancel" 
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className="transfer-modal-btn transfer-modal-btn--confirm" 
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="transfer-modal-spinner"></span>
                Signing...
              </>
            ) : (
              "Confirm & Sign"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
