import React, { useState, useEffect } from "react";
import authService, { ConstituentInfo } from "../services/authService";

interface ConstituentManagerProps {
  constituentId?: string;
}

const ConstituentManager: React.FC<ConstituentManagerProps> = ({ constituentId }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [constituent, setConstituent] = useState<ConstituentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState<string>(constituentId || "");
  const [cacheStats, setCacheStats] = useState<{ count: number; totalSize: number; oldestEntry?: Date; pendingPromises: number }>({ count: 0, totalSize: 0, pendingPromises: 0 });

  useEffect(() => {
    updateCacheStats();
    
    // Set up periodic updates to show real-time pending promises
    const interval = setInterval(updateCacheStats, 500);
    
    return () => clearInterval(interval);
  }, []);

  const updateCacheStats = () => {
    const stats = authService.getCacheStats();
    setCacheStats(stats);
  };

  const fetchConstituent = async (id: string, useCache: boolean = true) => {
    if (!id.trim()) {
      setError("Please enter a constituent ID");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const constituentData = await authService.getConstituent(id, useCache);
      setConstituent(constituentData);
      updateCacheStats();
    } catch (err: any) {
      setError(err.message || "Failed to fetch constituent");
      setConstituent(null);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = (specificId?: string) => {
    authService.clearConstituentCache(specificId);
    updateCacheStats();
    if (!specificId) {
      setConstituent(null);
    }
  };

  const testPromiseMemoization = async () => {
    if (!searchId.trim()) {
      setError("Please enter a constituent ID to test");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Make 5 simultaneous requests for the same constituent
      // Only one API call should be made due to promise memoization
      console.log("Starting 5 simultaneous requests for the same constituent...");
      const promises = Array(5).fill(null).map((_, index) => {
        console.log(`Starting request ${index + 1}`);
        return authService.getConstituent(searchId, false); // Force fresh API calls
      });

      const results = await Promise.all(promises);
      console.log("All requests completed:", results);
      
      setConstituent(results[0]); // All should be the same
      updateCacheStats();
    } catch (err: any) {
      setError(err.message || "Failed to test promise memoization");
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "800px",
    margin: "20px auto",
    padding: "20px",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: "10px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#f8f9fa",
    padding: "15px",
    borderRadius: "8px",
    marginBottom: "15px",
    border: "1px solid #dee2e6",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "8px 16px",
    margin: "0 5px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#007bff",
    color: "white",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#6c757d",
    color: "white",
  };

  const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#dc3545",
    color: "white",
  };

  return (
    <div style={containerStyle}>
      <h2>🔍 Constituent Manager</h2>
      <p>Demonstrate Blackbaud Constituent API integration with localStorage caching</p>

      {/* Cache Statistics */}
      <div style={cardStyle}>
        <h4>📊 Cache Statistics</h4>
        <p><strong>Cached Constituents:</strong> {cacheStats.count}</p>
        <p><strong>Cache Size:</strong> {formatBytes(cacheStats.totalSize)}</p>
        <p><strong>Pending Requests:</strong> {cacheStats.pendingPromises}</p>
        {cacheStats.oldestEntry && (
          <p><strong>Oldest Entry:</strong> {cacheStats.oldestEntry.toLocaleString()}</p>
        )}
        <button
          style={dangerButtonStyle}
          onClick={() => clearCache()}
        >
          Clear All Cache
        </button>
      </div>

      {/* Search Form */}
      <div style={cardStyle}>
        <h4>🔎 Search Constituent</h4>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Enter Constituent ID"
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
          <button
            style={primaryButtonStyle}
            onClick={() => fetchConstituent(searchId, true)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Fetch (with cache)"}
          </button>
          <button
            style={secondaryButtonStyle}
            onClick={() => fetchConstituent(searchId, false)}
            disabled={loading}
          >
            Force Refresh
          </button>
          <button
            style={{ ...buttonStyle, backgroundColor: "#17a2b8", color: "white" }}
            onClick={testPromiseMemoization}
            disabled={loading}
            title="Make 5 simultaneous requests to test promise memoization"
          >
            Test Deduplication
          </button>
        </div>
        {error && (
          <div style={{ color: "red", fontSize: "14px", marginBottom: "10px" }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Constituent Details */}
      {constituent && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h4>👤 Constituent Details</h4>
            <button
              style={dangerButtonStyle}
              onClick={() => clearCache(constituent.id)}
            >
              Clear This Cache
            </button>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <div>
              <h5>Basic Information</h5>
              <p><strong>ID:</strong> {constituent.id}</p>
              <p><strong>Name:</strong> {constituent.name || `${constituent.first || ''} ${constituent.last || ''}`.trim()}</p>
              {constituent.preferred_name && (
                <p><strong>Preferred Name:</strong> {constituent.preferred_name}</p>
              )}
              {constituent.title && (
                <p><strong>Title:</strong> {constituent.title}</p>
              )}
              {constituent.lookup_id && (
                <p><strong>Lookup ID:</strong> {constituent.lookup_id}</p>
              )}
              {constituent.gender && (
                <p><strong>Gender:</strong> {constituent.gender}</p>
              )}
              {constituent.marital_status && (
                <p><strong>Marital Status:</strong> {constituent.marital_status}</p>
              )}
              {constituent.deceased && (
                <p><strong>Status:</strong> <span style={{ color: "red" }}>Deceased</span></p>
              )}
            </div>

            <div>
              <h5>Contact Information</h5>
              {constituent.email && (
                <p><strong>Email:</strong> {constituent.email.address}
                  {constituent.email.primary && <span style={{ color: "green" }}> (Primary)</span>}
                </p>
              )}
              {constituent.phone && (
                <p><strong>Phone:</strong> {constituent.phone.number}
                  {constituent.phone.primary && <span style={{ color: "green" }}> (Primary)</span>}
                </p>
              )}
              {constituent.address && (
                <div>
                  <p><strong>Address:</strong></p>
                  <div style={{ marginLeft: "15px", fontSize: "14px" }}>
                    {constituent.address.address_lines?.map((line, index) => (
                      <div key={index}>{line}</div>
                    ))}
                    <div>{constituent.address.city}, {constituent.address.state} {constituent.address.postal_code}</div>
                    {constituent.address.country && <div>{constituent.address.country}</div>}
                    {constituent.address.primary && <span style={{ color: "green" }}>(Primary)</span>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {constituent.birthdate && (
            <div style={{ marginTop: "15px" }}>
              <h5>Additional Information</h5>
              <p><strong>Birthdate:</strong> {constituent.birthdate.m}/{constituent.birthdate.d}/{constituent.birthdate.y}</p>
            </div>
          )}

          <div style={{ marginTop: "15px", fontSize: "12px", color: "#666" }}>
            <p><strong>Date Added:</strong> {constituent.date_added ? new Date(constituent.date_added).toLocaleString() : "N/A"}</p>
            <p><strong>Date Modified:</strong> {constituent.date_modified ? new Date(constituent.date_modified).toLocaleString() : "N/A"}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConstituentManager; 