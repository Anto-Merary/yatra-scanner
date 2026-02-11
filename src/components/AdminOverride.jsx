/**
 * AdminOverride Component — YATRA 2026
 * 
 * Protected admin interface for:
 * - Force allowing entry (with day selection)
 * - Resetting entry (with day selection)
 * - Viewing ticket status and override logs
 * 
 * Access: Requires separate admin PIN
 * All actions are logged for audit trail
 */

import { useState } from 'react';
import { searchTickets, getTicketStatus } from '../lib/ticketVerification';
import { CategoryNames } from '../lib/ticketVerification';
import { adminForceAllow, adminResetEntry, getOverrideLogs } from '../lib/adminOverride';
import { getAdminPin } from '../lib/supabase';

export default function AdminOverride({ onClose, onResult }) {
  const [pinVerified, setPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [overrideLogs, setOverrideLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [actionReason, setActionReason] = useState('');
  const [adminName, setAdminName] = useState('');
  const [selectedDay, setSelectedDay] = useState(1);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Verify admin PIN
  const handlePinSubmit = (e) => {
    e.preventDefault();
    const correctPin = getAdminPin();

    if (pinInput === correctPin) {
      setPinVerified(true);
      setPinError('');
    } else {
      setPinError('Invalid admin PIN');
      setPinInput('');
    }
  };

  // Search for tickets
  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 3) return;

    setLoading(true);
    const results = await searchTickets(searchQuery);
    setSearchResults(results);
    setLoading(false);
  };

  // Select a ticket to view details
  const handleSelectTicket = async (ticket) => {
    setLoading(true);

    // Fetch full ticket details
    const fullDetails = await getTicketStatus(ticket.id);
    if (fullDetails.found) {
      setSelectedTicket(fullDetails.ticket);
    } else {
      setSelectedTicket(ticket);
    }

    // Get override logs
    const logs = await getOverrideLogs(ticket.id);
    setOverrideLogs(logs);

    setLoading(false);
  };

  // Force allow entry
  const handleForceAllow = async () => {
    if (!actionReason || actionReason.trim().length < 10) {
      alert('Please provide a reason (minimum 10 characters)');
      return;
    }

    if (!adminName || adminName.trim().length < 2) {
      alert('Please enter your name for audit trail');
      return;
    }

    if (!confirm(`Force allow entry for ${selectedTicket.name} (Day ${selectedDay})?\\n\\nThis action will be logged.`)) {
      return;
    }

    setActionInProgress(true);
    const result = await adminForceAllow(
      selectedTicket.id,
      selectedDay,
      actionReason,
      adminName
    );
    setActionInProgress(false);

    if (result.success) {
      alert(`✓ Entry forced successfully\\n\\n${result.message}`);
      setActionReason('');
      handleSelectTicket(selectedTicket);
    } else {
      alert(`✗ Failed to force entry\\n\\n${result.message}`);
    }
  };

  // Reset entry
  const handleResetEntry = async () => {
    if (!actionReason || actionReason.trim().length < 10) {
      alert('Please provide a reason (minimum 10 characters)');
      return;
    }

    if (!adminName || adminName.trim().length < 2) {
      alert('Please enter your name for audit trail');
      return;
    }

    const dayLabel = selectedDay === 0 ? 'ALL DAYS' : `Day ${selectedDay}`;
    if (!confirm(`Reset entry for ${selectedTicket.name} (${dayLabel})?\\n\\nThis action will be logged.`)) {
      return;
    }

    setActionInProgress(true);
    const result = await adminResetEntry(
      selectedTicket.id,
      selectedDay,
      actionReason,
      adminName
    );
    setActionInProgress(false);

    if (result.success) {
      alert(`✓ Entry reset successfully\\n\\n${result.message}`);
      setActionReason('');
      handleSelectTicket(selectedTicket);
    } else {
      alert(`✗ Failed to reset entry\\n\\n${result.message}`);
    }
  };

  // Format usage timestamp
  const formatUsage = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
      day: '2-digit', month: 'short'
    });
  };

  // Get status display
  const getStatusDisplay = (ticket) => {
    if (ticket.status === 'revoked') return { text: 'Revoked', class: 'revoked' };
    if (ticket.status === 'active') return { text: 'Active', class: 'active' };
    return { text: ticket.status || 'Unknown', class: '' };
  };

  // PIN verification screen
  if (!pinVerified) {
    return (
      <div className="admin-override-screen">
        <div className="admin-overlay-content">
          <h2>ADMIN OVERRIDE</h2>
          <p className="admin-warning">Protected Area - Admin Access Only</p>

          <form onSubmit={handlePinSubmit} className="admin-pin-form">
            <label htmlFor="admin-pin">Enter Admin PIN:</label>
            <input
              id="admin-pin"
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••"
              autoFocus
              maxLength={6}
            />

            {pinError && <div className="admin-pin-error">{pinError}</div>}

            <div className="admin-pin-buttons">
              <button type="submit" disabled={!pinInput}>
                Verify
              </button>
              <button type="button" onClick={onClose} className="cancel-btn">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Main admin interface
  return (
    <div className="admin-override-screen">
      <div className="admin-header">
        <h2>ADMIN OVERRIDE MODE</h2>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="admin-content">
        {/* Search section */}
        {!selectedTicket && (
          <div className="admin-search-section">
            <h3>Search Ticket</h3>
            <div className="admin-search-form">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, email, code, or college..."
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} disabled={loading || searchQuery.length < 3}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="admin-search-results">
                {searchResults.map((ticket) => {
                  const statusInfo = getStatusDisplay(ticket);
                  return (
                    <div
                      key={ticket.id}
                      className="admin-ticket-result"
                      onClick={() => handleSelectTicket(ticket)}
                    >
                      <div className="admin-ticket-code">{ticket.code_6_digit}</div>
                      <div className="admin-ticket-info">
                        <div className="admin-ticket-name">{ticket.name}</div>
                        <div className="admin-ticket-email">{ticket.email}</div>
                        {ticket.category && (
                          <div className="admin-ticket-category">
                            Cat {ticket.category} — {CategoryNames[ticket.category] || ''}
                          </div>
                        )}
                      </div>
                      <div className="admin-ticket-status">
                        <span className={statusInfo.class}>
                          {statusInfo.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Ticket details and actions */}
        {selectedTicket && (
          <div className="admin-ticket-details">
            <button onClick={() => setSelectedTicket(null)} className="back-btn">
              ← Back
            </button>

            {/* Ticket info card */}
            <div className="admin-ticket-card">
              <div className="admin-ticket-header">
                <div className="admin-ticket-code-large">{selectedTicket.code_6_digit}</div>
                <span className={`admin-status-badge ${getStatusDisplay(selectedTicket).class}`}>
                  {getStatusDisplay(selectedTicket).text}
                </span>
              </div>

              <div className="admin-ticket-info-compact">
                <div className="admin-info-item">
                  <span className="info-label">Name</span>
                  <span className="info-value">{selectedTicket.name}</span>
                </div>
                <div className="admin-info-item">
                  <span className="info-label">Email</span>
                  <span className="info-value">{selectedTicket.email}</span>
                </div>
                {selectedTicket.college && (
                  <div className="admin-info-item">
                    <span className="info-label">College</span>
                    <span className="info-value">{selectedTicket.college}</span>
                  </div>
                )}
                <div className="admin-info-item">
                  <span className="info-label">Category</span>
                  <span className="info-value">
                    Cat {selectedTicket.category} — {CategoryNames[selectedTicket.category] || 'Unknown'}
                  </span>
                </div>
                {selectedTicket.event_id && (
                  <div className="admin-info-item">
                    <span className="info-label">Event</span>
                    <span className="info-value">{selectedTicket.event_id}</span>
                  </div>
                )}
                {selectedTicket.valid_days && selectedTicket.valid_days.length > 0 && (
                  <div className="admin-info-item">
                    <span className="info-label">Valid Days</span>
                    <span className="info-value">{selectedTicket.valid_days.join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Usage status */}
              <div className="admin-usage-section">
                <h4>Usage Status</h4>
                <div className="admin-usage-grid">
                  <div className={`admin-usage-item ${selectedTicket.usage_day1 ? 'used' : 'unused'}`}>
                    <span className="usage-label">Day 1</span>
                    <span className="usage-value">{formatUsage(selectedTicket.usage_day1)}</span>
                  </div>
                  <div className={`admin-usage-item ${selectedTicket.usage_day2 ? 'used' : 'unused'}`}>
                    <span className="usage-label">Day 2</span>
                    <span className="usage-value">{formatUsage(selectedTicket.usage_day2)}</span>
                  </div>
                  {selectedTicket.category === 2 && (
                    <div className={`admin-usage-item ${selectedTicket.usage_event ? 'used' : 'unused'}`}>
                      <span className="usage-label">Event</span>
                      <span className="usage-value">{formatUsage(selectedTicket.usage_event)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Override actions */}
            <div className="admin-actions-card">
              {/* Day selector */}
              <div className="admin-day-selector">
                <label>Target Day:</label>
                <div className="day-selector-buttons">
                  <button
                    type="button"
                    className={`day-btn ${selectedDay === 1 ? 'active' : ''}`}
                    onClick={() => setSelectedDay(1)}
                  >
                    Day 1
                  </button>
                  <button
                    type="button"
                    className={`day-btn ${selectedDay === 2 ? 'active' : ''}`}
                    onClick={() => setSelectedDay(2)}
                  >
                    Day 2
                  </button>
                  <button
                    type="button"
                    className={`day-btn ${selectedDay === 0 ? 'active' : ''}`}
                    onClick={() => setSelectedDay(0)}
                  >
                    All
                  </button>
                </div>
              </div>

              <div className="admin-form-group">
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Your name"
                  className="admin-name-input"
                />
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Reason (min 10 chars)"
                  rows={2}
                  className="admin-reason-input"
                />
              </div>

              <div className="admin-action-buttons">
                <button
                  onClick={handleForceAllow}
                  disabled={actionInProgress || !actionReason || !adminName}
                  className="force-allow-btn"
                >
                  {actionInProgress ? 'Processing...' : `Force Allow (Day ${selectedDay || 'All'})`}
                </button>
                <button
                  onClick={handleResetEntry}
                  disabled={actionInProgress || !actionReason || !adminName}
                  className="reset-entry-btn"
                >
                  {actionInProgress ? 'Processing...' : `Reset Entry (${selectedDay === 0 ? 'All' : 'Day ' + selectedDay})`}
                </button>
              </div>
            </div>

            {/* Override logs */}
            {overrideLogs.length > 0 && (
              <div className="admin-logs-card">
                <h4>History ({overrideLogs.length})</h4>
                <div className="admin-logs-list">
                  {overrideLogs.map((log) => (
                    <div key={log.id} className="admin-log-entry-compact">
                      <div className="log-header-compact">
                        <span className={`log-action-badge ${log.admin_action?.toLowerCase()}`}>
                          {log.admin_action}
                        </span>
                        <span className="log-time-compact">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="log-reason-compact">{log.reason}</div>
                      <div className="log-admin-compact">{log.admin_identifier}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
