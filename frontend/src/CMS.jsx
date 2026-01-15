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
