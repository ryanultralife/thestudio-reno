// ============================================
// CMS - CONTENT MANAGEMENT SYSTEM
// Easy interface for managing website content
// ============================================

import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ============================================
// MAIN CMS COMPONENT
// ============================================

export default function CMS({ token }) {
  const [activeTab, setActiveTab] = useState('locations');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const showMessage = (msg, type = 'success') => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Website Content Manager</h1>
          <p className="text-gray-600 mt-1">Manage your website content in one place</p>
        </div>
      </div>

      {/* Message Toast */}
      {message && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`px-6 py-3 rounded-lg shadow-lg ${
            message.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white font-medium`}>
            {message.text}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="flex border-b overflow-x-auto">
            {[
              { id: 'locations', label: 'Locations', icon: '📍' },
              { id: 'teachers', label: 'Teachers', icon: '👨‍🏫' },
              { id: 'campaigns', label: 'Auto Emails', icon: '📧' },
              { id: 'schedule', label: 'Quick Schedule', icon: '📅' },
              { id: 'media', label: 'Media Library', icon: '🖼️' },
              { id: 'settings', label: 'Settings', icon: '⚙️' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 font-medium whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'border-b-2 border-amber-600 text-amber-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'locations' && <LocationsTab token={token} showMessage={showMessage} />}
            {activeTab === 'teachers' && <TeachersTab token={token} showMessage={showMessage} />}
            {activeTab === 'campaigns' && <CampaignsTab token={token} showMessage={showMessage} />}
            {activeTab === 'schedule' && <QuickScheduleTab token={token} showMessage={showMessage} />}
            {activeTab === 'media' && <MediaTab token={token} showMessage={showMessage} />}
            {activeTab === 'settings' && <SettingsTab token={token} showMessage={showMessage} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// LOCATIONS TAB
// ============================================

function LocationsTab({ token, showMessage }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/cms/locations`);
      const data = await res.json();
      setLocations(data.locations);
    } catch (err) {
      showMessage('Failed to load locations', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Studio Locations</h2>
        <p className="text-gray-600 mb-6">
          Manage your studio locations. Update addresses, hours, and descriptions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {locations.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            token={token}
            showMessage={showMessage}
            onUpdate={fetchLocations}
          />
        ))}
      </div>
    </div>
  );
}

function LocationCard({ location, token, showMessage, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(location);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/locations/${location.slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to save');

      showMessage('Location updated successfully!');
      setEditing(false);
      onUpdate();
    } catch (err) {
      showMessage('Failed to update location', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="border rounded-lg p-6 bg-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold">{location.name}</h3>
            <p className="text-sm text-gray-500">{location.slug}</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-amber-600 hover:text-amber-700 font-medium"
          >
            Edit
          </button>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <p>{location.address_line1}</p>
          {location.address_line2 && <p>{location.address_line2}</p>}
          <p>{location.city}, {location.state} {location.zip}</p>
          <p className="pt-2">{location.phone}</p>
          <p>{location.email}</p>
          {location.description && (
            <p className="pt-2 text-gray-700">{location.description}</p>
          )}
        </div>

        {location.has_tea_lounge && (
          <span className="inline-block mt-4 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
            Has Tea Lounge
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address Line 1
          </label>
          <input
            type="text"
            value={formData.address_line1}
            onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address Line 2
          </label>
          <input
            type="text"
            value={formData.address_line2 || ''}
            onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ZIP
            </label>
            <input
              type="text"
              value={formData.zip}
              onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows="3"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id={`tea-lounge-${location.id}`}
            checked={formData.has_tea_lounge}
            onChange={(e) => setFormData({ ...formData, has_tea_lounge: e.target.checked })}
            className="w-4 h-4 text-amber-600 border-gray-300 rounded"
          />
          <label htmlFor={`tea-lounge-${location.id}`} className="ml-2 text-sm text-gray-700">
            Has Tea & Elixir Lounge
          </label>
        </div>

        <div className="flex gap-2 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => {
              setFormData(location);
              setEditing(false);
            }}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// TEACHERS TAB
// ============================================

function TeachersTab({ token, showMessage }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/cms/team`);
      const data = await res.json();
      setTeachers(data.teachers);
    } catch (err) {
      showMessage('Failed to load teachers', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Teacher Profiles</h2>
        <p className="text-gray-600 mb-6">
          Manage teacher bios, photos, and specialties that appear on the public website.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teachers.map((teacher) => (
          <TeacherCard
            key={teacher.id}
            teacher={teacher}
            token={token}
            showMessage={showMessage}
            onUpdate={fetchTeachers}
          />
        ))}
      </div>

      {teachers.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No teachers found. Add teachers from the Staff Portal → Settings → Staff page.
        </div>
      )}
    </div>
  );
}

function TeacherCard({ teacher, token, showMessage, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    bio: teacher.bio || '',
    photo_url: teacher.photo_url || '',
    specialties: Array.isArray(teacher.specialties) ? teacher.specialties.join(', ') : '',
    certifications: Array.isArray(teacher.certifications) ? teacher.certifications.join(', ') : '',
    instagram: teacher.instagram || '',
    website: teacher.website || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...formData,
        specialties: formData.specialties.split(',').map(s => s.trim()).filter(Boolean),
        certifications: formData.certifications.split(',').map(c => c.trim()).filter(Boolean),
      };

      const res = await fetch(`${API_URL}/api/cms/team/${teacher.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');

      showMessage('Teacher profile updated!');
      setEditing(false);
      onUpdate();
    } catch (err) {
      showMessage('Failed to update teacher profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="border rounded-lg p-6 bg-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-semibold">{teacher.first_name} {teacher.last_name}</h3>
            {teacher.specialties && teacher.specialties.length > 0 && (
              <p className="text-sm text-gray-500">{teacher.specialties.join(', ')}</p>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-amber-600 hover:text-amber-700 text-sm font-medium"
          >
            Edit
          </button>
        </div>

        {teacher.photo_url && (
          <img
            src={teacher.photo_url}
            alt={`${teacher.first_name} ${teacher.last_name}`}
            className="w-full h-48 object-cover rounded-lg mb-4"
          />
        )}

        {teacher.bio && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-3">{teacher.bio}</p>
        )}

        {(!teacher.bio && !teacher.photo_url && (!teacher.specialties || teacher.specialties.length === 0)) && (
          <p className="text-sm text-gray-400 italic">No profile information yet. Click Edit to add.</p>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6 bg-white">
      <h3 className="font-semibold mb-4">{teacher.first_name} {teacher.last_name}</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photo URL
          </label>
          <input
            type="url"
            value={formData.photo_url}
            onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
            placeholder="https://..."
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Paste image URL from Media Library</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bio
          </label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            rows="4"
            placeholder="Share your yoga journey, teaching style, and what makes your classes special..."
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Specialties
          </label>
          <input
            type="text"
            value={formData.specialties}
            onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
            placeholder="Vinyasa, Yin, Restorative"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Comma-separated</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Certifications
          </label>
          <input
            type="text"
            value={formData.certifications}
            onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
            placeholder="RYT-200, RYT-500"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Comma-separated</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Instagram
          </label>
          <input
            type="text"
            value={formData.instagram}
            onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
            placeholder="@username"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium text-sm transition"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium text-sm transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CAMPAIGNS TAB
// ============================================

function CampaignsTab({ token, showMessage }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`${API_URL}/api/campaigns`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCampaigns(data.campaigns);
    } catch (err) {
      showMessage('Failed to load campaigns', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Automated Email Campaigns</h2>
        <p className="text-gray-600 mb-6">
          Simple, automated emails that help keep your members engaged. Turn campaigns on/off and customize messages.
        </p>
      </div>

      <div className="space-y-4">
        {campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            token={token}
            showMessage={showMessage}
            onUpdate={fetchCampaigns}
          />
        ))}
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No campaigns found. Set up campaigns from the backend.
        </div>
      )}
    </div>
  );
}

function CampaignCard({ campaign, token, showMessage, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    email_subject: campaign.email_subject || '',
    email_body: campaign.email_body || '',
  });
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await fetch(`${API_URL}/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !campaign.is_active }),
      });

      if (!res.ok) throw new Error('Failed to toggle');

      showMessage(campaign.is_active ? 'Campaign paused' : 'Campaign activated');
      onUpdate();
    } catch (err) {
      showMessage('Failed to update campaign', 'error');
    } finally {
      setToggling(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to save');

      showMessage('Campaign message updated!');
      setEditing(false);
      onUpdate();
    } catch (err) {
      showMessage('Failed to update campaign', 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadPreview = async () => {
    if (preview) {
      setPreview(null);
      return;
    }

    setLoadingPreview(true);
    try {
      const res = await fetch(`${API_URL}/api/campaigns/${campaign.id}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPreview(data);
    } catch (err) {
      showMessage('Failed to load preview', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const triggerDescriptions = {
    membership_expiring: 'Sent when membership is about to expire',
    membership_expired: 'Sent after membership has expired',
    inactive_member: 'Sent when member hasn\'t visited recently',
    declining_attendance: 'Sent when attendance is dropping',
    no_upcoming_bookings: 'Sent when member has no classes booked',
    low_credits: 'Sent when credits are running low',
    teacher_no_classes: 'Sent when teacher hasn\'t taught recently',
    attendance_milestone: 'Sent after completing milestone classes',
    new_member_welcome: 'Sent to new members',
    birthday: 'Sent on member\'s birthday',
  };

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* Card Header */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg">{campaign.name}</h3>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                campaign.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {campaign.is_active ? '● Active' : '○ Paused'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {triggerDescriptions[campaign.trigger_type] || campaign.description}
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>📊 {campaign.total_sent || 0} sent</span>
              {campaign.last_run_at && (
                <span>🕐 Last: {new Date(campaign.last_run_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 ${
              campaign.is_active ? 'bg-green-500' : 'bg-gray-200'
            } ${toggling ? 'opacity-50' : ''}`}
          >
            <span
              className={`inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                campaign.is_active ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            {expanded ? '▲ Hide Details' : '▼ View & Edit Message'}
          </button>
          <button
            onClick={loadPreview}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium ml-4"
          >
            {loadingPreview ? 'Loading...' : preview ? '✕ Hide Preview' : '👁️ Preview Recipients'}
          </button>
        </div>
      </div>

      {/* Preview Section */}
      {preview && (
        <div className="px-6 pb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-2">Would send to {preview.count} people:</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {preview.targets.slice(0, 10).map((target) => (
                <div key={target.user_id} className="text-sm text-gray-700">
                  {target.first_name} {target.last_name} ({target.email})
                </div>
              ))}
              {preview.count > 10 && (
                <div className="text-sm text-gray-500 italic">
                  ...and {preview.count - 10} more
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expanded Message Section */}
      {expanded && (
        <div className="border-t bg-gray-50 p-6">
          {!editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
                <div className="bg-white border rounded-lg p-3 text-sm">
                  {campaign.email_subject || <span className="text-gray-400 italic">No subject set</span>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
                <div className="bg-white border rounded-lg p-3 text-sm whitespace-pre-wrap">
                  {campaign.email_body || <span className="text-gray-400 italic">No message set</span>}
                </div>
              </div>
              <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-3">
                <strong>Available merge tags:</strong> {'{{first_name}}, {{last_name}}, {{expiration_date}}, {{credits_remaining}}, {{schedule_link}}, {{renewal_link}}'}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition"
              >
                Edit Message
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
                <input
                  type="text"
                  value={formData.email_subject}
                  onChange={(e) => setFormData({ ...formData, email_subject: e.target.value })}
                  placeholder="Email subject line..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
                <textarea
                  value={formData.email_body}
                  onChange={(e) => setFormData({ ...formData, email_body: e.target.value })}
                  rows="8"
                  placeholder="Write your email message here. Use {{first_name}}, {{credits_remaining}}, etc. for personalization."
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                />
              </div>
              <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-3">
                <strong>Merge tags you can use:</strong>
                <div className="mt-2 space-y-1">
                  <div><code>{'{{first_name}}'}</code> - Member&apos;s first name</div>
                  <div><code>{'{{last_name}}'}</code> - Member&apos;s last name</div>
                  <div><code>{'{{expiration_date}}'}</code> - Membership expiration date</div>
                  <div><code>{'{{credits_remaining}}'}</code> - Remaining class credits</div>
                  <div><code>{'{{schedule_link}}'}</code> - Link to class schedule</div>
                  <div><code>{'{{renewal_link}}'}</code> - Link to renewal page</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium text-sm transition"
                >
                  {saving ? 'Saving...' : 'Save Message'}
                </button>
                <button
                  onClick={() => {
                    setFormData({
                      email_subject: campaign.email_subject || '',
                      email_body: campaign.email_body || '',
                    });
                    setEditing(false);
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// QUICK SCHEDULE TAB (Placeholder)
// ============================================

function QuickScheduleTab({ token, showMessage }) {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">📅</div>
      <h2 className="text-xl font-semibold mb-2">Schedule Management</h2>
      <p className="text-gray-600 mb-6">
        Manage your class schedule from the main Staff Portal.
      </p>
      <a
        href="/admin"
        className="inline-block bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-medium transition"
      >
        Go to Staff Portal → Schedule
      </a>
    </div>
  );
}

// ============================================
// MEDIA TAB (Placeholder)
// ============================================

function MediaTab({ token, showMessage }) {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">🖼️</div>
      <h2 className="text-xl font-semibold mb-2">Media Library</h2>
      <p className="text-gray-600 mb-6">
        Upload and manage photos via Cloudinary.
      </p>
      <p className="text-sm text-gray-500">
        For now, upload images to{' '}
        <a href="https://cloudinary.com" target="_blank" rel="noopener" className="text-amber-600 hover:underline">
          Cloudinary
        </a>
        {' '}and paste the URLs into your content.
      </p>
    </div>
  );
}

// ============================================
// SETTINGS TAB (Placeholder)
// ============================================

function SettingsTab({ token, showMessage }) {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">⚙️</div>
      <h2 className="text-xl font-semibold mb-2">Site Settings</h2>
      <p className="text-gray-600">
        Advanced settings coming soon. Contact support for branding changes.
      </p>
    </div>
  );
}
