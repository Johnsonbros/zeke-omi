import { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Plus, Trash2, Edit2, X, Clock, Calendar, 
  Home, Building2, Dumbbell, GraduationCap, UtensilsCrossed, 
  ShoppingBag, Stethoscope, Users, User, MoreHorizontal,
  ChevronLeft, BarChart3, Navigation, Timer
} from 'lucide-react';
import { placesApi, api, type Place, type PlaceCreate, type PlaceStats, type PlaceVisit } from '../lib/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type ViewMode = 'list' | 'detail';

const CATEGORIES = [
  { value: 'home', label: 'Home', icon: Home },
  { value: 'work', label: 'Work', icon: Building2 },
  { value: 'school', label: 'School', icon: GraduationCap },
  { value: 'gym', label: 'Gym', icon: Dumbbell },
  { value: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { value: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { value: 'medical', label: 'Medical', icon: Stethoscope },
  { value: 'family', label: 'Family', icon: Users },
  { value: 'friend', label: 'Friend', icon: User },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

function getCategoryIcon(category: string) {
  const cat = CATEGORIES.find(c => c.value === category.toLowerCase());
  return cat?.icon || MapPin;
}

function getCategoryLabel(category: string) {
  const cat = CATEGORIES.find(c => c.value === category.toLowerCase());
  return cat?.label || category;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function PlaceMap({ lat, lng, radius }: { lat: number; lng: number; radius: number }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstanceRef.current);

      const icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });

      L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
      L.circle([lat, lng], { radius, color: '#8b5cf6', fillOpacity: 0.2 }).addTo(mapInstanceRef.current);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, radius]);

  return <div ref={mapRef} className="h-full w-full rounded-lg" />;
}

export function Places() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [placeStats, setPlaceStats] = useState<PlaceStats | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'other',
    latitude: 0,
    longitude: 0,
    radius_meters: 100,
    useCurrentLocation: true,
  });

  useEffect(() => {
    loadPlaces();
  }, []);

  async function loadPlaces() {
    try {
      const data = await placesApi.list();
      setPlaces(data);
    } catch (err) {
      console.error('Failed to load places:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlaceStats(place: Place) {
    setSelectedPlace(place);
    setViewMode('detail');
    try {
      const stats = await placesApi.getStats(place.id);
      setPlaceStats(stats);
    } catch (err) {
      console.error('Failed to load place stats:', err);
    }
  }

  async function handleOpenModal(place?: Place) {
    if (place) {
      setEditingPlace(place);
      setFormData({
        name: place.name,
        category: place.category,
        latitude: place.latitude,
        longitude: place.longitude,
        radius_meters: place.radius_meters,
        useCurrentLocation: false,
      });
    } else {
      setEditingPlace(null);
      const currentLocation = await api.getCurrentLocation();
      setFormData({
        name: '',
        category: 'other',
        latitude: currentLocation?.latitude || 0,
        longitude: currentLocation?.longitude || 0,
        radius_meters: 100,
        useCurrentLocation: true,
      });
    }
    setShowModal(true);
  }

  async function handleGetCurrentLocation() {
    const currentLocation = await api.getCurrentLocation();
    if (currentLocation) {
      setFormData(prev => ({
        ...prev,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        useCurrentLocation: true,
      }));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || saving) return;

    setSaving(true);
    try {
      const placeData: PlaceCreate = {
        name: formData.name,
        latitude: formData.latitude,
        longitude: formData.longitude,
        radius_meters: formData.radius_meters,
        category: formData.category,
      };

      if (editingPlace) {
        const updated = await placesApi.update(editingPlace.id, placeData);
        setPlaces(places.map(p => p.id === updated.id ? updated : p));
      } else {
        const created = await placesApi.create(placeData);
        setPlaces([created, ...places]);
      }
      setShowModal(false);
      setEditingPlace(null);
    } catch (err) {
      console.error('Failed to save place:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this place?')) return;

    try {
      await placesApi.delete(id);
      setPlaces(places.filter(p => p.id !== id));
      if (selectedPlace?.id === id) {
        setViewMode('list');
        setSelectedPlace(null);
      }
    } catch (err) {
      console.error('Failed to delete place:', err);
    }
  }

  function handleBackToList() {
    setViewMode('list');
    setSelectedPlace(null);
    setPlaceStats(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <MapPin className="w-12 h-12 text-purple-400 animate-bounce" />
          <p className="text-slate-400">Loading places...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {viewMode === 'list' ? (
        <PlacesListView
          places={places}
          onAddPlace={() => handleOpenModal()}
          onEditPlace={handleOpenModal}
          onDeletePlace={handleDelete}
          onSelectPlace={loadPlaceStats}
        />
      ) : (
        <PlaceDetailView
          place={selectedPlace!}
          stats={placeStats}
          onBack={handleBackToList}
          onEdit={() => handleOpenModal(selectedPlace!)}
          onDelete={() => handleDelete(selectedPlace!.id)}
        />
      )}

      {showModal && (
        <PlaceModal
          formData={formData}
          setFormData={setFormData}
          editingPlace={editingPlace}
          saving={saving}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingPlace(null); }}
          onGetCurrentLocation={handleGetCurrentLocation}
        />
      )}
    </div>
  );
}

function PlacesListView({
  places,
  onAddPlace,
  onEditPlace,
  onDeletePlace,
  onSelectPlace,
}: {
  places: Place[];
  onAddPlace: () => void;
  onEditPlace: (place: Place) => void;
  onDeletePlace: (id: string) => void;
  onSelectPlace: (place: Place) => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            Places
          </h1>
          <p className="text-slate-400 mt-2 text-sm md:text-base">
            {places.length} saved {places.length === 1 ? 'place' : 'places'}
          </p>
        </div>
        <button
          onClick={onAddPlace}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-3 py-2 md:px-4 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity flex-shrink-0 shadow-lg shadow-purple-500/25"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden md:inline">Add Place</span>
        </button>
      </div>

      {places.length === 0 ? (
        <div className="bg-slate-900 rounded-xl p-8 md:p-12 text-center border border-slate-700">
          <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No places saved yet.</p>
          <p className="text-slate-500 text-sm mt-2">Add a place to start tracking your visits.</p>
          <button
            onClick={onAddPlace}
            className="mt-4 inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Your First Place
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {places.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              onSelect={() => onSelectPlace(place)}
              onEdit={() => onEditPlace(place)}
              onDelete={() => onDeletePlace(place.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function PlaceCard({
  place,
  onSelect,
  onEdit,
  onDelete,
}: {
  place: Place;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const CategoryIcon = getCategoryIcon(place.category);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden hover:border-purple-500/50 transition-colors group">
      <button
        onClick={onSelect}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <CategoryIcon className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors">
                {place.name}
              </h3>
              <span className="text-xs text-purple-400 font-medium uppercase tracking-wide">
                {getCategoryLabel(place.category)}
              </span>
            </div>
          </div>
          {place.is_confirmed && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
              Confirmed
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
              <Navigation className="w-3.5 h-3.5" />
              Visits
            </div>
            <p className="text-white font-semibold">{place.visit_count}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
              <Timer className="w-3.5 h-3.5" />
              Time Spent
            </div>
            <p className="text-white font-semibold">{formatDuration(place.total_dwell_time_minutes)}</p>
          </div>
        </div>

        {place.last_visited && (
          <div className="mt-3 flex items-center gap-1.5 text-slate-500 text-sm">
            <Calendar className="w-4 h-4" />
            Last visited: {formatDate(place.last_visited)}
          </div>
        )}
      </button>

      <div className="flex border-t border-slate-700">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          <span className="text-sm">Edit</span>
        </button>
        <div className="w-px bg-slate-700" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm">Delete</span>
        </button>
      </div>
    </div>
  );
}

function PlaceDetailView({
  place,
  stats,
  onBack,
  onEdit,
  onDelete,
}: {
  place: Place;
  stats: PlaceStats | null;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const CategoryIcon = getCategoryIcon(place.category);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl md:text-2xl font-bold text-white flex-1 truncate">
          {place.name}
        </h1>
        <button
          onClick={onEdit}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Edit2 className="w-5 h-5" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
        <div className="h-48 md:h-64">
          <PlaceMap lat={place.latitude} lng={place.longitude} radius={place.radius_meters} />
        </div>
        
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <CategoryIcon className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{place.name}</h2>
              <span className="text-sm text-purple-400 font-medium uppercase tracking-wide">
                {getCategoryLabel(place.category)}
              </span>
            </div>
          </div>

          {place.address && (
            <p className="text-slate-400 text-sm mb-4">{place.address}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-purple-400 text-xs mb-1">
                <Navigation className="w-3.5 h-3.5" />
                Total Visits
              </div>
              <p className="text-white font-bold text-lg">{place.visit_count}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-blue-400 text-xs mb-1">
                <Timer className="w-3.5 h-3.5" />
                Total Time
              </div>
              <p className="text-white font-bold text-lg">{formatDuration(place.total_dwell_time_minutes)}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-green-400 text-xs mb-1">
                <BarChart3 className="w-3.5 h-3.5" />
                Avg Time
              </div>
              <p className="text-white font-bold text-lg">
                {stats ? formatDuration(stats.average_dwell_minutes) : '--'}
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-cyan-400 text-xs mb-1">
                <MapPin className="w-3.5 h-3.5" />
                Radius
              </div>
              <p className="text-white font-bold text-lg">{place.radius_meters}m</p>
            </div>
          </div>
        </div>
      </div>

      {stats && stats.visits_by_day && Object.keys(stats.visits_by_day).length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 md:p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            Visits by Day
          </h3>
          <div className="flex gap-2">
            {dayNames.map((day, index) => {
              const count = stats.visits_by_day[index] || 0;
              const maxCount = Math.max(...Object.values(stats.visits_by_day));
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full h-24 bg-slate-800 rounded-lg flex items-end">
                    <div 
                      className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-lg transition-all"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">{day}</span>
                  <span className="text-xs text-slate-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats && stats.visits && stats.visits.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 md:p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Recent Visits
          </h3>
          <div className="space-y-3">
            {stats.visits.slice(0, 10).map((visit) => (
              <VisitItem key={visit.id} visit={visit} />
            ))}
          </div>
        </div>
      )}

      {stats && stats.memories_count > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 md:p-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-400" />
            Memories at this Place
          </h3>
          <p className="text-slate-400 mt-2">
            {stats.memories_count} {stats.memories_count === 1 ? 'memory' : 'memories'} created here
          </p>
        </div>
      )}
    </>
  );
}

function VisitItem({ visit }: { visit: PlaceVisit }) {
  const enteredDate = new Date(visit.entered_at);
  const exitedDate = visit.exited_at ? new Date(visit.exited_at) : null;
  
  return (
    <div className="bg-slate-800 rounded-lg p-3 flex items-center justify-between">
      <div>
        <p className="text-white font-medium">
          {enteredDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </p>
        <p className="text-slate-400 text-sm">
          {enteredDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          {exitedDate && (
            <> → {exitedDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</>
          )}
        </p>
      </div>
      {visit.dwell_minutes && (
        <span className="text-purple-400 font-medium">
          {formatDuration(visit.dwell_minutes)}
        </span>
      )}
    </div>
  );
}

function PlaceModal({
  formData,
  setFormData,
  editingPlace,
  saving,
  onSave,
  onClose,
  onGetCurrentLocation,
}: {
  formData: {
    name: string;
    category: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    useCurrentLocation: boolean;
  };
  setFormData: React.Dispatch<React.SetStateAction<typeof formData>>;
  editingPlace: Place | null;
  saving: boolean;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
  onGetCurrentLocation: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {editingPlace ? 'Edit Place' : 'Add New Place'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Home, Office, Gym"
              className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-600 focus:outline-none focus:border-purple-500 text-base"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-600 focus:outline-none focus:border-purple-500 text-base"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-400">Location</label>
              <button
                type="button"
                onClick={onGetCurrentLocation}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <Navigation className="w-3 h-3" />
                Use Current
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0, useCurrentLocation: false })}
                  placeholder="Latitude"
                  step="any"
                  className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-600 focus:outline-none focus:border-purple-500 text-base"
                />
                <span className="text-xs text-slate-500 mt-1">Latitude</span>
              </div>
              <div>
                <input
                  type="number"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0, useCurrentLocation: false })}
                  placeholder="Longitude"
                  step="any"
                  className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-600 focus:outline-none focus:border-purple-500 text-base"
                />
                <span className="text-xs text-slate-500 mt-1">Longitude</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
              Radius: {formData.radius_meters}m
            </label>
            <input
              type="range"
              min="50"
              max="500"
              step="10"
              value={formData.radius_meters}
              onChange={(e) => setFormData({ ...formData, radius_meters: parseInt(e.target.value) })}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>50m</span>
              <span>500m</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name.trim()}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-3 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
            >
              {saving ? 'Saving...' : editingPlace ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
