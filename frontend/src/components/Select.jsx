import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './Icons';

// Reusable Select/Dropdown component with search, sorting, and proper mapping
export function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  labelKey = 'name',
  valueKey = 'id',
  sortKey = null, // key to sort by (defaults to labelKey)
  sortDir = 'asc',
  searchable = false,
  disabled = false,
  className = '',
  renderOption = null, // custom render function for options
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Get label from option
  const getLabel = (opt) => typeof labelKey === 'function' ? labelKey(opt) : opt[labelKey];
  const getValue = (opt) => opt[valueKey];

  // Sort options
  const sortedOptions = [...options].sort((a, b) => {
    const key = sortKey || labelKey;
    const aVal = typeof key === 'function' ? key(a) : a[key];
    const bVal = typeof key === 'function' ? key(b) : b[key];
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === 'desc' ? -cmp : cmp;
  });

  // Filter by search
  const filteredOptions = searchable && search
    ? sortedOptions.filter(opt => getLabel(opt)?.toLowerCase().includes(search.toLowerCase()))
    : sortedOptions;

  // Find selected option
  const selected = options.find(opt => getValue(opt) === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`w-full px-4 py-2.5 border rounded-lg text-left flex items-center justify-between ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-gray-400'
        } ${open ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-300'}`}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <Icons.ChevronDown className={`w-5 h-5 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
          {searchable && (
            <div className="p-2 border-b">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                autoFocus
              />
            </div>
          )}
          <div className="overflow-y-auto max-h-52">
            {filteredOptions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-500">No options</p>
            ) : (
              filteredOptions.map((opt, i) => (
                <button
                  key={getValue(opt) || i}
                  type="button"
                  onClick={() => { onChange(getValue(opt)); setOpen(false); setSearch(''); }}
                  className={`w-full px-4 py-2.5 text-left hover:bg-amber-50 flex items-center justify-between ${
                    getValue(opt) === value ? 'bg-amber-50 text-amber-700' : 'text-gray-700'
                  }`}
                >
                  {renderOption ? renderOption(opt) : getLabel(opt)}
                  {getValue(opt) === value && <Icons.Check className="w-4 h-4 text-amber-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Teacher select with first+last name
export function TeacherSelect({ value, onChange, teachers, placeholder = 'Select teacher...' }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={teachers}
      placeholder={placeholder}
      labelKey={(t) => `${t.first_name} ${t.last_name}`}
      valueKey="id"
      sortKey={(t) => `${t.first_name} ${t.last_name}`}
      searchable={teachers.length > 5}
      renderOption={(t) => (
        <div className="flex items-center gap-3">
          {t.photo_url ? (
            <img src={t.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
              {t.first_name?.[0]}{t.last_name?.[0]}
            </div>
          )}
          <div>
            <p className="font-medium">{t.first_name} {t.last_name}</p>
            {t.title && <p className="text-xs text-gray-500">{t.title}</p>}
          </div>
        </div>
      )}
    />
  );
}

// Class type select with category grouping
export function ClassTypeSelect({ value, onChange, classTypes, placeholder = 'Select class type...' }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={classTypes}
      placeholder={placeholder}
      labelKey="name"
      valueKey="id"
      sortKey={(c) => `${c.category || 'zzz'}-${c.name}`}
      searchable={classTypes.length > 5}
      renderOption={(c) => (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {c.color && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></span>}
            <span>{c.name}</span>
          </div>
          <span className="text-xs text-gray-500">{c.duration}min</span>
        </div>
      )}
    />
  );
}

// Location select
export function LocationSelect({ value, onChange, locations, placeholder = 'Select location...' }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={locations}
      placeholder={placeholder}
      labelKey="name"
      valueKey="id"
      sortKey="name"
      renderOption={(l) => (
        <div>
          <p className="font-medium">{l.name}</p>
          {l.address && <p className="text-xs text-gray-500">{l.address}</p>}
        </div>
      )}
    />
  );
}

// Time select (hours)
export function TimeSelect({ value, onChange, startHour = 5, endHour = 22, interval = 30 }) {
  const times = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += interval) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const label = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      times.push({ value: time, label });
    }
  }
  return (
    <Select
      value={value}
      onChange={onChange}
      options={times}
      placeholder="Select time..."
      labelKey="label"
      valueKey="value"
    />
  );
}

// Day of week select
export function DaySelect({ value, onChange }) {
  const days = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];
  return (
    <Select
      value={value}
      onChange={onChange}
      options={days}
      placeholder="Select day..."
      labelKey="label"
      valueKey="value"
    />
  );
}

export default Select;
