/**
 * ResultScreen Component
 * 
 * Full-screen result display after ticket verification.
 * GREEN = Entry allowed
 * RED = Entry rejected
 * 
 * Shows comprehensive ticket details:
 * - Name, Email, College, Phone
 * - Ticket type and 6-digit code
 * - Entry status with timestamp
 * - RIT student badge
 */

import { useEffect } from 'react';

export default function ResultScreen({ result, onDismiss, onManualSearch }) {
  const {
    allowed,
    reason,
    message,
    ticket_type,
    ticketType, // Legacy support
    name,
    email,
    college,
    phone,
    code_6_digit,
    is_rit_student,
    last_used_at,
    ticket_id
  } = result;

  // Use either new or legacy ticket type field
  const displayTicketType = ticket_type || ticketType;

  // Auto-dismiss after 6 seconds (increased for more info)
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  // Get display text based on reason
  const getReasonText = () => {
    switch (reason) {
      case 'VALID':
        return 'ENTRY ALLOWED';
      case 'ALREADY_USED':
        return 'ALREADY USED TODAY';
      case 'INVALID_TICKET':
        return 'INVALID TICKET';
      case 'ERROR':
        return 'SYSTEM ERROR';
      default:
        return 'REJECTED';
    }
  };

  // Get current time formatted
  const currentTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const currentDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Format last used time if available
  const formatLastUsed = (timestamp) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      day: '2-digit',
      month: 'short'
    });
  };

  return (
    <div
      className={`result-screen ${allowed ? 'result-allowed' : 'result-rejected'}`}
      onClick={onDismiss}
    >
      <div className="result-content">
        {/* Status Header */}
        <div className="result-header">
          <div className="result-icon">
            {allowed ? '✓' : '✕'}
          </div>
          <h1 className="result-status">
            {getReasonText()}
          </h1>
        </div>

        {/* Ticket Details Card */}
        <div className="result-ticket-card">
          {/* Badge Row */}
          <div className="result-badges">
            {displayTicketType && (
              <span className="result-badge badge-type">
                {displayTicketType}
              </span>
            )}
            {is_rit_student && (
              <span className="result-badge badge-rit">
                RIT STUDENT
              </span>
            )}
            {code_6_digit && (
              <span className="result-badge badge-code">
                #{code_6_digit}
              </span>
            )}
          </div>

          {/* Name - Large and prominent */}
          {name && (
            <h2 className="result-name">{name}</h2>
          )}

          {/* Details Grid */}
          <div className="result-details-grid">
            {email && (
              <div className="result-detail-item">
                <span className="detail-icon">📧</span>
                <span className="detail-text">{email}</span>
              </div>
            )}
            {college && (
              <div className="result-detail-item">
                <span className="detail-icon">🏫</span>
                <span className="detail-text">{college}</span>
              </div>
            )}
            {phone && (
              <div className="result-detail-item">
                <span className="detail-icon">📱</span>
                <span className="detail-text">{phone}</span>
              </div>
            )}
          </div>

          {/* Entry Time Info */}
          <div className="result-time-section">
            <div className="result-time-row">
              <span className="time-label">Scanned:</span>
              <span className="time-value">{currentTime}</span>
            </div>
            <div className="result-time-row">
              <span className="time-label">Date:</span>
              <span className="time-value">{currentDate}</span>
            </div>
            {!allowed && last_used_at && (
              <div className="result-time-row warning">
                <span className="time-label">Last Entry:</span>
                <span className="time-value">{formatLastUsed(last_used_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Message */}
        <p className="result-message">{message}</p>

        {/* Action buttons */}
        <div className="result-actions">
          <button onClick={onDismiss} className="result-btn-primary">
            {allowed ? '✓ Scan Next' : 'Close'}
          </button>
          {!allowed && (
            <button onClick={onManualSearch} className="result-btn-secondary">
              🔍 Manual Search
            </button>
          )}
        </div>

        {/* Tap hint */}
        <p className="result-hint">Tap anywhere to dismiss • Auto-close in 6s</p>
      </div>
    </div>
  );
}
