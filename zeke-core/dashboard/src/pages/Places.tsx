import { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Plus, Trash2, Edit2, X, Clock, Calendar, 
  Home, Building2, Dumbbell, GraduationCap, UtensilsCrossed, 
  ShoppingBag, Stethoscope, Users, User, MoreHorizontal,
  ChevronLeft, BarChart3, Navigation, Timer, Lightbulb, TrendingUp, RefreshCw, Check,
  Battery, Compass, Tag, Zap, List, LogIn, LogOut, Bell, Settings, CheckSquare, 
  ToggleLeft, ToggleRight, FolderPlus
} from 'lucide-react';
import { placesApi, api, type Place, type PlaceCreate, type PlaceStats, type PlaceVisit, type PlaceSuggestion, type Routine, type LocationContext, type PlaceTag, type PlaceTrigger, type PlaceList, type PlaceTriggerCreate } from '../lib/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type ViewMode = 'list' | 'detail' | 'listDetail';

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

function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
      }).setView([lat, lng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstanceRef.current);

      const icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });

      L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng]);

  return <div ref={mapRef} className="h-full w-full rounded-lg" />;
}

function CurrentLocationCard({ 
  locationContext, 
  onQuickAdd,
  isSaving 
}: { 
  locationContext: LocationContext | null;
  onQuickAdd?: (lat: number, lng: number) => void;
  isSaving?: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !locationContext) return;

    const lat = locationContext.current_latitude;
    const lng = locationContext.current_longitude;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([lat, lng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(mapInstanceRef.current);

      const icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });

      markerRef.current = L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
    } else {
      mapInstanceRef.current.setView([lat, lng], 15);
      markerRef.current?.setLatLng([lat, lng]);
    }
  }, [locationContext]);

  if (!locationContext) {
    return (
      <div className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Location</h2>
        </div>
        <div className="text-center py-8">
          <Compass className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
          <p className="text-slate-400">Waiting for location data...</p>
          <p className="text-slate-500 text-sm mt-1">Make sure Overland is running on your phone</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-purple-400" />
          Location
        </h2>
        <span className="text-xs text-slate-500">
          {new Date(locationContext.last_updated).toLocaleTimeString()}
        </span>
      </div>
      
      <div className="h-48 md:h-56 rounded-lg overflow-hidden mb-4">
        <div ref={mapRef} className="h-full w-full" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-purple-400 mb-1">
            <Navigation className="w-4 h-4" />
            <span className="text-xs">Motion</span>
          </div>
          <p className="text-slate-200 font-medium capitalize">{locationContext.current_motion}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <MapPin className="w-4 h-4" />
            <span className="text-xs">Status</span>
          </div>
          <p className="text-slate-200 font-medium">
            {locationContext.is_at_home ? 'At Home' : locationContext.is_traveling ? 'Traveling' : 'Away'}
          </p>
        </div>
        {locationContext.current_speed !== null && locationContext.current_speed > 0 && (
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <Navigation className="w-4 h-4" />
              <span className="text-xs">Speed</span>
            </div>
            <p className="text-slate-200 font-medium">{Math.round(locationContext.current_speed * 2.237)} mph</p>
          </div>
        )}
        {locationContext.battery_level !== null && (
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-400 mb-1">
              <Battery className="w-4 h-4" />
              <span className="text-xs">Battery</span>
            </div>
            <p className="text-slate-200 font-medium">
              {Math.round(locationContext.battery_level * 100)}%
            </p>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700">
        <p className="text-slate-400 text-sm">
          {locationContext.current_latitude.toFixed(4)}, {locationContext.current_longitude.toFixed(4)}
        </p>
        {onQuickAdd && (
          <button
            onClick={() => onQuickAdd(locationContext.current_latitude, locationContext.current_longitude)}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Save Location
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
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
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [locationContext, setLocationContext] = useState<LocationContext | null>(null);
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [allTags, setAllTags] = useState<PlaceTag[]>([]);
  const [placeLists, setPlaceLists] = useState<PlaceList[]>([]);
  const [selectedList, setSelectedList] = useState<PlaceList | null>(null);
  const [listPlaces, setListPlaces] = useState<Place[]>([]);
  
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
    fetchSuggestions();
    fetchRoutines();
    fetchLocationContext();
    fetchTags();
    fetchPlaceLists();
  }, []);

  async function fetchLocationContext() {
    try {
      const data = await api.getLocationContext();
      setLocationContext(data);
    } catch (error) {
      console.error('Error fetching location context:', error);
    }
  }

  async function fetchTags() {
    try {
      const data = await placesApi.listTags();
      setAllTags(data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }

  async function fetchPlaceLists() {
    try {
      const data = await placesApi.listPlaceLists();
      setPlaceLists(data);
    } catch (error) {
      console.error('Error fetching place lists:', error);
    }
  }

  async function handleCreateList(name: string, description?: string) {
    await placesApi.createPlaceList(name, description);
    fetchPlaceLists();
  }

  async function handleDeleteList(listId: string) {
    await placesApi.deletePlaceList(listId);
    fetchPlaceLists();
  }

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

  async function fetchSuggestions() {
    setLoadingSuggestions(true);
    try {
      const data = await placesApi.discoverPlaces();
      setSuggestions(data);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function fetchRoutines() {
    try {
      const data = await placesApi.getRoutines();
      setRoutines(data);
    } catch (error) {
      console.error('Error fetching routines:', error);
    }
  }

  async function handleQuickAdd(lat: number, lng: number) {
    const name = prompt('Name this location (or leave empty for auto-generated name):');
    if (name === null) return;
    
    setQuickAddSaving(true);
    try {
      await placesApi.quickAdd({
        latitude: lat,
        longitude: lng,
        name: name || undefined,
        category: 'other',
      });
      loadPlaces();
    } catch (error) {
      console.error('Error quick adding place:', error);
      alert('Failed to save location. Please try again.');
    } finally {
      setQuickAddSaving(false);
    }
  }

  async function confirmSuggestion(suggestion: PlaceSuggestion) {
    const name = prompt('Name this place:', suggestion.suggested_category);
    if (!name) return;
    
    try {
      await placesApi.confirmDiscoveredPlace({
        name,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        category: suggestion.suggested_category
      });
      loadPlaces();
      fetchSuggestions();
    } catch (error) {
      console.error('Error confirming place:', error);
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

  async function handleSelectList(list: PlaceList) {
    setSelectedList(list);
    setViewMode('listDetail');
    try {
      const places = await placesApi.getListPlaces(list.id);
      setListPlaces(places);
    } catch (error) {
      console.error('Error loading list places:', error);
    }
  }

  function handleBackFromListDetail() {
    setViewMode('list');
    setSelectedList(null);
    setListPlaces([]);
  }

  async function handleRemoveFromListDetail(placeId: string) {
    if (!selectedList) return;
    await placesApi.removePlaceFromList(selectedList.id, placeId);
    setListPlaces(listPlaces.filter(p => p.id !== placeId));
  }

  async function handleAddToListDetail(placeId: string) {
    if (!selectedList) return;
    await placesApi.addPlaceToList(selectedList.id, placeId);
    const updatedPlaces = await placesApi.getListPlaces(selectedList.id);
    setListPlaces(updatedPlaces);
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
          suggestions={suggestions}
          routines={routines}
          loadingSuggestions={loadingSuggestions}
          onRefreshSuggestions={fetchSuggestions}
          onConfirmSuggestion={confirmSuggestion}
          locationContext={locationContext}
          onQuickAdd={handleQuickAdd}
          quickAddSaving={quickAddSaving}
          allTags={allTags}
          placeLists={placeLists}
          onCreateList={handleCreateList}
          onDeleteList={handleDeleteList}
          onSelectList={handleSelectList}
        />
      ) : viewMode === 'listDetail' ? (
        <PlaceListDetail
          list={selectedList!}
          places={listPlaces}
          allPlaces={places}
          onBack={handleBackFromListDetail}
          onRemovePlace={handleRemoveFromListDetail}
          onAddPlace={handleAddToListDetail}
          onDeleteList={(id) => {
            handleDeleteList(id);
            handleBackFromListDetail();
          }}
          onUpdateList={fetchPlaceLists}
        />
      ) : (
        <PlaceDetailView
          place={selectedPlace!}
          stats={placeStats}
          onBack={handleBackToList}
          onEdit={() => handleOpenModal(selectedPlace!)}
          onDelete={() => handleDelete(selectedPlace!.id)}
          allTags={allTags}
          placeLists={placeLists}
          onTagsChange={fetchTags}
          onListsChange={fetchPlaceLists}
          onPlaceUpdate={loadPlaces}
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
  suggestions,
  routines,
  loadingSuggestions,
  onRefreshSuggestions,
  onConfirmSuggestion,
  locationContext,
  onQuickAdd,
  quickAddSaving,
  allTags,
  placeLists,
  onCreateList,
  onDeleteList,
  onSelectList,
}: {
  places: Place[];
  onAddPlace: () => void;
  onEditPlace: (place: Place) => void;
  onDeletePlace: (id: string) => void;
  onSelectPlace: (place: Place) => void;
  suggestions: PlaceSuggestion[];
  routines: Routine[];
  loadingSuggestions: boolean;
  onRefreshSuggestions: () => void;
  onConfirmSuggestion: (suggestion: PlaceSuggestion) => void;
  locationContext: LocationContext | null;
  onQuickAdd: (lat: number, lng: number) => void;
  quickAddSaving: boolean;
  allTags: PlaceTag[];
  placeLists: PlaceList[];
  onCreateList: (name: string, description?: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onSelectList: (list: PlaceList) => void;
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

      {/* Current Location Card */}
      <CurrentLocationCard 
        locationContext={locationContext} 
        onQuickAdd={onQuickAdd}
        isSaving={quickAddSaving}
      />

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
              tags={allTags}
            />
          ))}
        </div>
      )}

      {/* Place Lists Section */}
      <PlaceListsSection
        placeLists={placeLists}
        onCreateList={onCreateList}
        onDeleteList={onDeleteList}
        onSelectList={onSelectList}
      />

      {/* Suggested Places Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            Suggested Places
          </h2>
          <button
            onClick={onRefreshSuggestions}
            disabled={loadingSuggestions}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSuggestions ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {loadingSuggestions ? (
          <div className="text-center py-4">
            <p className="text-slate-400">Analyzing your location history...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-slate-400">No new places discovered.</p>
            <p className="text-slate-500 text-sm mt-1">Keep tracking your location to discover frequently visited spots.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={index}
                suggestion={suggestion}
                onConfirm={() => onConfirmSuggestion(suggestion)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detected Routines Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-green-400" />
          Detected Routines
        </h2>
        
        {routines.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-slate-400">No routines detected yet.</p>
            <p className="text-slate-500 text-sm mt-1">Visit your saved places regularly to build patterns.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {routines.slice(0, 10).map((routine, index) => (
              <RoutineCard key={index} routine={routine} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SuggestionCard({
  suggestion,
  onConfirm,
}: {
  suggestion: PlaceSuggestion;
  onConfirm: () => void;
}) {
  const CategoryIcon = getCategoryIcon(suggestion.suggested_category);
  
  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-yellow-500/50 transition-colors">
      <div className="h-32 relative">
        <MiniMap lat={suggestion.latitude} lng={suggestion.longitude} />
        <div className="absolute top-2 left-2 p-1.5 bg-yellow-500/90 rounded-lg shadow-lg">
          <CategoryIcon className="w-4 h-4 text-white" />
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-sm text-yellow-400 font-medium uppercase tracking-wide">
              {getCategoryLabel(suggestion.suggested_category)}
            </span>
            <p className="text-white font-semibold">{suggestion.visit_count} visits</p>
            <p className="text-slate-500 text-xs mt-1">Last seen: {formatDate(suggestion.last_seen)}</p>
          </div>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1 bg-yellow-600 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-700 transition-colors text-sm flex-shrink-0"
          >
            <Check className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function RoutineCard({ routine }: { routine: Routine }) {
  const confidenceColor = routine.confidence >= 0.75 ? 'text-green-400' : 
                          routine.confidence >= 0.5 ? 'text-yellow-400' : 'text-slate-400';
  const confidenceLabel = routine.confidence >= 0.75 ? 'Strong' : 
                          routine.confidence >= 0.5 ? 'Moderate' : 'Weak';
  
  return (
    <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-500/20 rounded-lg">
          <Clock className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <p className="text-white font-medium">{routine.place_name}</p>
          <p className="text-slate-400 text-sm">
            {routine.day}s at {routine.time_display}
          </p>
        </div>
      </div>
      <div className="text-right">
        <span className={`text-sm font-medium ${confidenceColor}`}>
          {confidenceLabel}
        </span>
        <p className="text-slate-500 text-xs">
          {routine.occurrence_count} occurrences
        </p>
      </div>
    </div>
  );
}

function PlaceListDetail({
  list,
  places,
  allPlaces,
  onBack,
  onRemovePlace,
  onAddPlace,
  onDeleteList,
  onUpdateList,
}: {
  list: PlaceList;
  places: Place[];
  allPlaces: Place[];
  onBack: () => void;
  onRemovePlace: (placeId: string) => Promise<void>;
  onAddPlace: (placeId: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onUpdateList: () => Promise<void>;
}) {
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(list.name);
  const [editingDesc, setEditingDesc] = useState(false);
  const [newDesc, setNewDesc] = useState(list.description || '');
  const [saving, setSaving] = useState(false);

  const availablePlaces = allPlaces.filter(p => !places.some(lp => lp.id === p.id));

  async function handleSaveName() {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      // API call would go here for updating list
      setEditingName(false);
      await onUpdateList();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-white flex-1">{list.name}</h1>
        <button
          onClick={() => {
            if (confirm(`Delete list "${list.name}"?`)) {
              onDeleteList(list.id);
            }
          }}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {list.description && (
        <p className="text-slate-400 text-sm">{list.description}</p>
      )}

      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Places in this list ({places.length})</h2>
        
        {places.length === 0 ? (
          <p className="text-slate-400 text-sm mb-4">No places in this list yet.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {places.map(place => (
              <div key={place.id} className="bg-slate-800 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-slate-700 rounded">
                    <MapPin className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{place.name}</p>
                    <p className="text-slate-500 text-xs capitalize">{place.category}</p>
                  </div>
                </div>
                <button
                  onClick={() => onRemovePlace(place.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {availablePlaces.length > 0 && (
          <div className="border-t border-slate-700 pt-4">
            <p className="text-slate-400 text-sm mb-3">Add places to this list:</p>
            <div className="space-y-2">
              {availablePlaces.map(place => (
                <button
                  key={place.id}
                  onClick={() => onAddPlace(place.id)}
                  className="w-full text-left bg-slate-800 hover:bg-slate-700 rounded-lg p-3 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-purple-400" />
                    <span className="text-white text-sm">{place.name}</span>
                  </div>
                  <span className="text-slate-500 text-xs capitalize">{place.category}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceListsSection({
  placeLists,
  onCreateList,
  onDeleteList,
  onSelectList,
}: {
  placeLists: PlaceList[];
  onCreateList: (name: string, description?: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onSelectList: (list: PlaceList) => void;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim() || creating) return;
    setCreating(true);
    try {
      await onCreateList(newListName.trim(), newListDescription.trim() || undefined);
      setNewListName('');
      setNewListDescription('');
      setShowCreateForm(false);
    } finally {
      setCreating(false);
    }
  }

  const LIST_COLORS = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <List className="w-5 h-5 text-blue-400" />
          Place Lists
        </h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
          New List
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-slate-800 rounded-lg p-4 mb-4 space-y-3">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="List name (e.g., Workout Spots)"
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-purple-500 text-sm"
            autoFocus
          />
          <input
            type="text"
            value={newListDescription}
            onChange={(e) => setNewListDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-purple-500 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-3 py-1.5 text-slate-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newListName.trim() || creating}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-500 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {placeLists.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-slate-400">No lists created yet.</p>
          <p className="text-slate-500 text-sm mt-1">Create lists to organize your places.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {placeLists.map((list, index) => (
            <div
              key={list.id}
              onClick={() => onSelectList(list)}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-purple-500 hover:bg-slate-750 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="p-2 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: `${list.color || LIST_COLORS[index % LIST_COLORS.length]}20` }}
                  >
                    <List
                      className="w-5 h-5"
                      style={{ color: list.color || LIST_COLORS[index % LIST_COLORS.length] }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-medium truncate">{list.name}</h3>
                    <p className="text-slate-500 text-xs">
                      {list.place_count} {list.place_count === 1 ? 'place' : 'places'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete list "${list.name}"?`)) {
                      onDeleteList(list.id);
                    }
                  }}
                  className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {list.description && (
                <p className="text-slate-400 text-sm mt-2 line-clamp-2">{list.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceCard({
  place,
  onSelect,
  onEdit,
  onDelete,
  tags,
}: {
  place: Place;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  tags: PlaceTag[];
}) {
  const CategoryIcon = getCategoryIcon(place.category);
  const placeTags = tags.filter(t => place.tags?.includes(t.id));

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

        {placeTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {placeTags.slice(0, 4).map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${tag.color || '#8b5cf6'}20`,
                  color: tag.color || '#8b5cf6',
                }}
              >
                <Tag className="w-3 h-3" />
                {tag.name}
              </span>
            ))}
            {placeTags.length > 4 && (
              <span className="text-xs text-slate-400">+{placeTags.length - 4} more</span>
            )}
          </div>
        )}

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

        {(place.trigger_count ?? 0) > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-amber-500 text-sm">
            <Zap className="w-4 h-4" />
            {place.trigger_count} {place.trigger_count === 1 ? 'trigger' : 'triggers'} active
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
  allTags,
  placeLists,
  onTagsChange,
  onListsChange,
  onPlaceUpdate,
}: {
  place: Place;
  stats: PlaceStats | null;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  allTags: PlaceTag[];
  placeLists: PlaceList[];
  onTagsChange: () => void;
  onListsChange: () => void;
  onPlaceUpdate: () => void;
}) {
  const CategoryIcon = getCategoryIcon(place.category);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const [placeTags, setPlaceTags] = useState<PlaceTag[]>([]);
  const [triggers, setTriggers] = useState<PlaceTrigger[]>([]);
  const [currentLists, setCurrentLists] = useState<PlaceList[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingTriggers, setLoadingTriggers] = useState(true);
  const [loadingLists, setLoadingLists] = useState(true);
  
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#8b5cf6');
  const [showTagInput, setShowTagInput] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  
  const [showTriggerForm, setShowTriggerForm] = useState(false);
  const [newTrigger, setNewTrigger] = useState<PlaceTriggerCreate>({
    name: '',
    trigger_type: 'entry',
    action_type: 'notification',
    enabled: true,
    cooldown_minutes: 30,
  });
  const [creatingTrigger, setCreatingTrigger] = useState(false);
  
  const TAG_COLORS = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#06b6d4', '#84cc16'];
  
  useEffect(() => {
    loadPlaceTags();
    loadTriggers();
    loadCurrentLists();
  }, [place.id]);
  
  async function loadPlaceTags() {
    setLoadingTags(true);
    try {
      const tags = await placesApi.getPlaceTags(place.id);
      setPlaceTags(tags);
    } catch (error) {
      console.error('Error loading place tags:', error);
    } finally {
      setLoadingTags(false);
    }
  }
  
  async function loadTriggers() {
    setLoadingTriggers(true);
    try {
      const data = await placesApi.getPlaceTriggers(place.id);
      setTriggers(data);
    } catch (error) {
      console.error('Error loading triggers:', error);
    } finally {
      setLoadingTriggers(false);
    }
  }
  
  async function loadCurrentLists() {
    setLoadingLists(true);
    try {
      const lists = await placesApi.getPlaceLists(place.id);
      setCurrentLists(lists);
    } catch (error) {
      console.error('Error loading place lists:', error);
    } finally {
      setLoadingLists(false);
    }
  }
  
  async function handleAddTag(tagId: string) {
    await placesApi.addTagToPlace(place.id, tagId);
    loadPlaceTags();
    onPlaceUpdate();
  }
  
  async function handleRemoveTag(tagId: string) {
    await placesApi.removeTagFromPlace(place.id, tagId);
    loadPlaceTags();
    onPlaceUpdate();
  }
  
  async function handleCreateAndAddTag() {
    if (!newTagName.trim() || creatingTag) return;
    setCreatingTag(true);
    try {
      const tag = await placesApi.createTag(newTagName.trim(), newTagColor);
      await placesApi.addTagToPlace(place.id, tag.id);
      setNewTagName('');
      setShowTagInput(false);
      loadPlaceTags();
      onTagsChange();
      onPlaceUpdate();
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setCreatingTag(false);
    }
  }
  
  async function handleToggleTrigger(triggerId: string, enabled: boolean) {
    await placesApi.updateTrigger(place.id, triggerId, enabled);
    loadTriggers();
  }
  
  async function handleDeleteTrigger(triggerId: string) {
    if (!confirm('Delete this trigger?')) return;
    await placesApi.deleteTrigger(place.id, triggerId);
    loadTriggers();
    onPlaceUpdate();
  }
  
  async function handleCreateTrigger(e: React.FormEvent) {
    e.preventDefault();
    if (!newTrigger.name.trim() || creatingTrigger) return;
    setCreatingTrigger(true);
    try {
      await placesApi.createTrigger(place.id, newTrigger);
      setNewTrigger({ name: '', trigger_type: 'entry', action_type: 'notification', enabled: true, cooldown_minutes: 30 });
      setShowTriggerForm(false);
      loadTriggers();
      onPlaceUpdate();
    } catch (error) {
      console.error('Error creating trigger:', error);
    } finally {
      setCreatingTrigger(false);
    }
  }
  
  async function handleAddToList(listId: string) {
    await placesApi.addPlaceToList(listId, place.id);
    loadCurrentLists();
    onListsChange();
  }
  
  async function handleRemoveFromList(listId: string) {
    await placesApi.removePlaceFromList(listId, place.id);
    loadCurrentLists();
    onListsChange();
  }
  
  const availableTags = allTags.filter(t => !placeTags.some(pt => pt.id === t.id));
  const availableLists = placeLists.filter(l => !currentLists.some(cl => cl.id === l.id));
  
  const ACTION_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    notification: { label: 'Notification', icon: <Bell className="w-4 h-4" /> },
    reminder: { label: 'Reminder', icon: <Clock className="w-4 h-4" /> },
    mode_switch: { label: 'Mode Switch', icon: <Settings className="w-4 h-4" /> },
    task_create: { label: 'Create Task', icon: <CheckSquare className="w-4 h-4" /> },
  };

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

      {/* Tags Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-pink-400" />
            Tags
          </h3>
          <button
            onClick={() => setShowTagInput(!showTagInput)}
            className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Tag
          </button>
        </div>
        
        {loadingTags ? (
          <p className="text-slate-400 text-sm">Loading tags...</p>
        ) : (
          <>
            {placeTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {placeTags.map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium group"
                    style={{
                      backgroundColor: `${tag.color || '#8b5cf6'}20`,
                      color: tag.color || '#8b5cf6',
                    }}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            
            {showTagInput && (
              <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                {availableTags.length > 0 && (
                  <div>
                    <p className="text-slate-400 text-xs mb-2">Existing tags:</p>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => handleAddTag(tag.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
                          style={{
                            backgroundColor: `${tag.color || '#8b5cf6'}20`,
                            color: tag.color || '#8b5cf6',
                          }}
                        >
                          <Plus className="w-3 h-3" />
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="border-t border-slate-700 pt-3">
                  <p className="text-slate-400 text-xs mb-2">Or create new:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Tag name"
                      className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-purple-500 text-sm"
                    />
                    <div className="flex gap-1">
                      {TAG_COLORS.slice(0, 4).map(color => (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={`w-8 h-8 rounded-lg border-2 transition-all ${newTagColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={handleCreateAndAddTag}
                      disabled={!newTagName.trim() || creatingTag}
                      className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-500 disabled:opacity-50"
                    >
                      {creatingTag ? '...' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {placeTags.length === 0 && !showTagInput && (
              <p className="text-slate-500 text-sm">No tags assigned to this place.</p>
            )}
          </>
        )}
      </div>

      {/* Triggers Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Triggers
          </h3>
          <button
            onClick={() => setShowTriggerForm(!showTriggerForm)}
            className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            New Trigger
          </button>
        </div>
        
        {loadingTriggers ? (
          <p className="text-slate-400 text-sm">Loading triggers...</p>
        ) : (
          <>
            {showTriggerForm && (
              <form onSubmit={handleCreateTrigger} className="bg-slate-800 rounded-lg p-4 mb-4 space-y-3">
                <input
                  type="text"
                  value={newTrigger.name}
                  onChange={(e) => setNewTrigger({ ...newTrigger, name: e.target.value })}
                  placeholder="Trigger name (e.g., Gym Reminder)"
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-purple-500 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">When:</label>
                    <select
                      value={newTrigger.trigger_type}
                      onChange={(e) => setNewTrigger({ ...newTrigger, trigger_type: e.target.value as 'entry' | 'exit' })}
                      className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-purple-500 text-sm"
                    >
                      <option value="entry">On Entry</option>
                      <option value="exit">On Exit</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Action:</label>
                    <select
                      value={newTrigger.action_type}
                      onChange={(e) => setNewTrigger({ ...newTrigger, action_type: e.target.value as PlaceTriggerCreate['action_type'] })}
                      className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-purple-500 text-sm"
                    >
                      <option value="notification">Notification</option>
                      <option value="reminder">Reminder</option>
                      <option value="mode_switch">Mode Switch</option>
                      <option value="task_create">Create Task</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowTriggerForm(false)}
                    className="px-3 py-1.5 text-slate-400 hover:text-white text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newTrigger.name.trim() || creatingTrigger}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-500 disabled:opacity-50"
                  >
                    {creatingTrigger ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            )}
            
            {triggers.length > 0 ? (
              <div className="space-y-2">
                {triggers.map(trigger => (
                  <div
                    key={trigger.id}
                    className="bg-slate-800 rounded-lg p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${trigger.trigger_type === 'entry' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        {trigger.trigger_type === 'entry' ? (
                          <LogIn className={`w-4 h-4 ${trigger.trigger_type === 'entry' ? 'text-green-400' : 'text-red-400'}`} />
                        ) : (
                          <LogOut className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{trigger.name}</p>
                        <p className="text-slate-400 text-xs flex items-center gap-1.5">
                          <span className={trigger.trigger_type === 'entry' ? 'text-green-400' : 'text-red-400'}>
                            On {trigger.trigger_type}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-amber-400">
                            {ACTION_TYPE_LABELS[trigger.action_type]?.icon}
                            {ACTION_TYPE_LABELS[trigger.action_type]?.label}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleTrigger(trigger.id, !trigger.enabled)}
                        className={`p-1.5 rounded-lg transition-colors ${trigger.enabled ? 'text-green-400 bg-green-500/10' : 'text-slate-500 bg-slate-700'}`}
                      >
                        {trigger.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleDeleteTrigger(trigger.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !showTriggerForm && <p className="text-slate-500 text-sm">No triggers set for this place.</p>
            )}
          </>
        )}
      </div>

      {/* Lists Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 md:p-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <List className="w-5 h-5 text-blue-400" />
          Lists
        </h3>
        
        {loadingLists ? (
          <p className="text-slate-400 text-sm">Loading lists...</p>
        ) : (
          <>
            {currentLists.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {currentLists.map(list => (
                  <span
                    key={list.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-500/20 text-blue-400 group"
                  >
                    <List className="w-3.5 h-3.5" />
                    {list.name}
                    <button
                      onClick={() => handleRemoveFromList(list.id)}
                      className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            
            {availableLists.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs mb-2">Add to list:</p>
                <div className="flex flex-wrap gap-2">
                  {availableLists.map(list => (
                    <button
                      key={list.id}
                      onClick={() => handleAddToList(list.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      {list.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {currentLists.length === 0 && availableLists.length === 0 && (
              <p className="text-slate-500 text-sm">No lists available. Create lists from the Places page.</p>
            )}
          </>
        )}
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
