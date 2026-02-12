/**
 * ResultScreen Component — YATRA 2026
 * 
 * Full-screen result display after ticket verification.
 * GREEN = Entry allowed
 * RED = Entry rejected
 * 
 * Handles all 9 result codes from validate_scan:
 *   VALID, TICKET_NOT_FOUND, TICKET_REVOKED, INVALID_DAY,
 *   TOO_EARLY_ENTRY, WRONG_GATE, EVENT_ONLY_TICKET,
 *   ALREADY_USED_TODAY, REPLAY_ATTACK
 */

import { useEffect } from 'react';
import { ResultDisplayText, CategoryNames } from '../lib/ticketVerification';

export default function ResultScreen({ result, onDismiss, onManualSearch }) {
  const {
    allowed,
    reason,
    message,
    ticket,  // Sub-object from validate_scan RPC
  } = result;

  // Extract ticket details (may be null for some error states)
  const name = ticket?.name;
  const email = ticket?.email;
  const college = ticket?.college;
  const phone = ticket?.phone;
  const code6Digit = ticket?.code_6_digit;
  const category = ticket?.category;
  const ticketType = ticket?.ticket_type;
  const isRitStudent = ticket?.is_rit_student;
  const eventId = ticket?.event_id;
  const ticketId = ticket?.ticket_id;
  const validDays = ticket?.valid_days;
  const usageDay1 = ticket?.usage_day1;
  const usageDay2 = ticket?.usage_day2;
  const passCategory = ticket?.pass_category;

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  // Get display text for the result
  const getReasonText = () => {
    return ResultDisplayText[reason] || 'REJECTED';
  };

  // Get category display name
  const getCategoryName = () => {
    if (!category) return null;
    if (ticketType === 'General Public') return 'General Public';
    return CategoryNames[category] || `Category ${category}`;
  };

  // Get category CSS class
  const getCategoryClass = () => {
    if (!category) return '';
    return `cat-${category}`;
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

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
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

  // Get contextual hint for rejection reason
  const getReasonHint = () => {
    switch (reason) {
      case 'TOO_EARLY_ENTRY':
        return 'Entry allowed only after 3:00 PM';
      case 'WRONG_GATE':
        return eventId ? `This ticket is for event: ${eventId}` : 'Wrong gate for this ticket type';
      case 'EVENT_ONLY_TICKET':
        return `Go to event gate: EVENT_${eventId}`;
      case 'INVALID_DAY':
        return validDays ? `Valid on: ${validDays.join(', ')}` : 'Not valid today';
      case 'ALREADY_USED_TODAY':
        return 'Ticket has already been scanned today';
      case 'REPLAY_ATTACK':
        return 'Wait a few seconds between scans';
      case 'TICKET_REVOKED':
        return 'This ticket has been revoked by admin';
      default:
        return null;
    }
  };

  return (
    <div
      className={`result-screen ${allowed
        ? 'result-allowed'
        : reason === 'ALREADY_USED_TODAY'
          ? 'result-warning'
          : 'result-rejected'
        }`}
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
            {category && (
              <span className={`result-badge badge-category ${getCategoryClass()}`}>
                {getCategoryName()}
              </span>
            )}
            {passCategory && (
              <span className="result-badge badge-type">
                {passCategory}
              </span>
            )}
            {ticketType && !category && (
              <span className="result-badge badge-type">
                {ticketType}
              </span>
            )}
            {isRitStudent && (
              <span className="result-badge badge-rit">
                RIT STUDENT
              </span>
            )}
            {code6Digit && (
              <span className="result-badge badge-code">
                #{code6Digit}
              </span>
            )}
            {eventId && (
              <span className="result-badge badge-event">
                {eventId.replace(/_/g, ' ')}
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

          {/* Reason Hint (for rejections) */}
          {!allowed && getReasonHint() && (
            <div className="result-reason-hint">
              ⓘ {getReasonHint()}
            </div>
          )}

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
            {!allowed && usageDay1 && (
              <div className="result-time-row warning">
                <span className="time-label">Day 1 Entry:</span>
                <span className="time-value">{formatTimestamp(usageDay1)}</span>
              </div>
            )}
            {!allowed && usageDay2 && (
              <div className="result-time-row warning">
                <span className="time-label">Day 2 Entry:</span>
                <span className="time-value">{formatTimestamp(usageDay2)}</span>
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
