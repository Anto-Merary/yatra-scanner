/**
 * FallbackSearch Component — YATRA 2026
 * 
 * Search tickets by email, name, code, or college.
 * Shows ticket status and allows entry via validate_scan.
 * 
 * Used when:
 * - QR code is damaged
 * - Attendee lost their ticket
 * - Need to check status without scanning
 */

import { useState } from 'react';
import { searchTickets, verifyTicketByQRToken, CategoryNames } from '../lib/ticketVerification';

export default function FallbackSearch({ onResult, gateType, scannerDevice }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [verifying, setVerifying] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (query.length < 3) return;

    setSearching(true);
    const tickets = await searchTickets(query);
    setResults(tickets);
    setSearching(false);
  };

  const handleVerify = async (ticket) => {
    if (!ticket.qr_token) {
      onResult({
        success: false,
        allowed: false,
        reason: 'ERROR',
        message: 'Ticket has no QR token. Cannot validate.',
      });
      return;
    }

    setVerifying(ticket.id);
    const result = await verifyTicketByQRToken(ticket.qr_token, gateType, scannerDevice);
    setVerifying(null);
    onResult(result);
  };

  const getStatusBadge = (ticket) => {
    if (ticket.status === 'revoked') {
      return { text: 'Revoked', class: 'badge-error' };
    }
    return { text: 'Active', class: 'badge-success' };
  };

  // Check if ticket is usable (simplified check — real validation happens server-side)
  const canAttemptEntry = (ticket) => {
    if (ticket.status === 'revoked') return false;
    if (!ticket.qr_token) return false;
    return true;
  };

  return (
    <div className="fallback-search">
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, code, or college..."
          className="search-input"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={searching || query.length < 3}
          className="search-btn"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="search-results">
          <p className="results-count">{results.length} ticket(s) found</p>

          {results.map((ticket) => {
            const status = getStatusBadge(ticket);
            const isVerifying = verifying === ticket.id;

            return (
              <div key={ticket.id} className="ticket-card">
                <div className="ticket-header">
                  <span className="ticket-code">{ticket.code_6_digit}</span>
                  <div className="ticket-header-badges">
                    {ticket.category && (
                      <span className={`ticket-badge badge-category cat-${ticket.category}`}>
                        Cat {ticket.category}
                      </span>
                    )}
                    <span className={`ticket-badge ${status.class}`}>
                      {status.text}
                    </span>
                  </div>
                </div>

                <div className="ticket-details">
                  {ticket.name && <p className="ticket-name">{ticket.name}</p>}
                  {ticket.email && <p className="ticket-email">{ticket.email}</p>}
                  {ticket.college && <p className="ticket-college">{ticket.college}</p>}
                  {ticket.category && (
                    <p className="ticket-category-label">
                      {CategoryNames[ticket.category] || `Category ${ticket.category}`}
                      {ticket.event_id ? ` — ${ticket.event_id}` : ''}
                    </p>
                  )}
                </div>

                <div className="ticket-usage">
                  {ticket.usage_day1 && <span className="usage-tag used">Day 1 ✓</span>}
                  {ticket.usage_day2 && <span className="usage-tag used">Day 2 ✓</span>}
                  {ticket.usage_event && <span className="usage-tag used">Event ✓</span>}
                  {!ticket.usage_day1 && !ticket.usage_day2 && !ticket.usage_event && (
                    <span className="usage-tag unused">Never used</span>
                  )}
                </div>

                <button
                  onClick={() => handleVerify(ticket)}
                  disabled={isVerifying || !canAttemptEntry(ticket)}
                  className="verify-btn"
                >
                  {isVerifying ? 'Verifying...' : 'Allow Entry'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {results.length === 0 && query.length >= 3 && !searching && (
        <p className="no-results">No tickets found for "{query}"</p>
      )}
    </div>
  );
}
