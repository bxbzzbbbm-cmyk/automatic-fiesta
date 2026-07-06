import React, { useState, useEffect } from 'react';

const VPNManager = () => {
  const [status, setStatus] = useState('disconnected');
  const [currentCountry, setCurrentCountry] = useState(null);
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [vpnIp, setVpnIp] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch available countries
  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      const response = await fetch('/api/countries.json');
      const data = await response.json();
      if (data.countries) {
        setCountries(data.countries);
      }
    } catch (error) {
      console.error('Error fetching countries:', error);
    }
  };

  // Check VPN status
  useEffect(() => {
    checkVPNStatus();
    const interval = setInterval(checkVPNStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkVPNStatus = async () => {
    try {
      const response = await fetch('/api/status.json');
      const data = await response.json();
      setStatus(data.status);
      if (data.status === 'connected') {
        setCurrentCountry(data.country);
        setVpnIp(data.vpn_ip);
      } else {
        setCurrentCountry(null);
        setVpnIp(null);
      }
    } catch (error) {
      console.error('Error checking VPN status:', error);
    }
  };

  const connectVPN = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/connect.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          country: selectedCountry,
          protocol: 'OpenVPN',
        }),
      });
      const data = await response.json();
      if (data.status === 'connected') {
        setStatus('connected');
        setCurrentCountry(data.country);
        setVpnIp(data.vpn_ip);
      }
    } catch (error) {
      console.error('Error connecting to VPN:', error);
    } finally {
      setLoading(false);
    }
  };

  const disconnectVPN = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/disconnect.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.status === 'disconnected') {
        setStatus('disconnected');
        setCurrentCountry(null);
        setVpnIp(null);
      }
    } catch (error) {
      console.error('Error disconnecting from VPN:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNewIP = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/generate-vpn-ip.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          country: selectedCountry,
          protocol: 'OpenVPN',
        }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        setVpnIp(data.generated_vpn_ip);
      }
    } catch (error) {
      console.error('Error generating new IP:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vpn-manager-container">
      <div className="vpn-header">
        <h1>VPN Manager</h1>
        <div className={`status-indicator ${status}`}>
          {status === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>

      <div className="vpn-content">
        {/* Current Status Section */}
        <div className="status-section">
          <h2>Current Status</h2>
          {status === 'connected' ? (
            <div className="status-info">
              <p>
                <strong>Country:</strong> {currentCountry}
              </p>
              <p>
                <strong>VPN IP:</strong> {vpnIp}
              </p>
            </div>
          ) : (
            <p className="disconnected-message">No active VPN connection</p>
          )}
        </div>

        {/* Country Selection Section */}
        <div className="country-section">
          <h2>Select Country</h2>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            disabled={status === 'connected' || loading}
          >
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name} ({country.code})
              </option>
            ))}
          </select>
        </div>

        {/* Controls Section */}
        <div className="controls-section">
          <h2>Controls</h2>
          <div className="button-group">
            {status === 'disconnected' ? (
              <button
                onClick={connectVPN}
                disabled={loading}
                className="btn btn-connect"
              >
                {loading ? 'Connecting...' : 'Connect VPN'}
              </button>
            ) : (
              <>
                <button
                  onClick={disconnectVPN}
                  disabled={loading}
                  className="btn btn-disconnect"
                >
                  {loading ? 'Disconnecting...' : 'Disconnect VPN'}
                </button>
                <button
                  onClick={generateNewIP}
                  disabled={loading}
                  className="btn btn-generate"
                >
                  {loading ? 'Generating...' : 'Generate New IP'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VPNManager;
