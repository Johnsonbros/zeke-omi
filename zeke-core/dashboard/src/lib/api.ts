const API_BASE = '/api';

export interface Memory {
  id: string;
  content: string;
  category: string;
  tags: string[];
  created_at: string;
  manually_added: boolean;
  primary_topic?: string;
  curation_status?: string;
  curation_notes?: string;
  curation_confidence?: number;
  enriched_context?: Record<string, unknown>;
}

export interface CurationStats {
  total_memories: number;
  pending_curation: number;
  clean: number;
  flagged: number;
  needs_review: number;
  curation_progress: number;
  by_topic: Record<string, number>;
  recent_runs: CurationRun[];
}

export interface CurationRun {
  id: string;
  user_id: string;
  status: string;
  memories_processed: number;
  memories_updated: number;
  memories_flagged: number;
  memories_deleted: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  error_message: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_at: string | null;
  created_at: string;
  completed_at: string | null;
  tags: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  message: string;
  intent: string;
  actions_taken: string[];
  data: Record<string, unknown>;
}

export interface Location {
  id: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  motion: string;
  activity: string | null;
  battery_level: number | null;
  battery_state: string | null;
  timestamp: string;
  created_at: string;
}

export interface LocationContext {
  current_latitude: number;
  current_longitude: number;
  current_motion: string;
  current_speed: number | null;
  battery_level: number | null;
  battery_state: string | null;
  last_updated: string;
  location_description: string | null;
  is_at_home: boolean;
  is_traveling: boolean;
  recent_locations_count: number;
}

export interface MotionSummary {
  summary: Record<string, number>;
  total_points: number;
  hours_analyzed: number;
  dominant_motion: string;
}

export interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  category: string;
  address?: string;
  visit_count: number;
  total_dwell_time_minutes: number;
  first_visited?: string;
  last_visited?: string;
  is_confirmed: boolean;
}

export interface PlaceCreate {
  name: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  category?: string;
}

export interface PlaceUpdate {
  name?: string;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  category?: string;
}

export interface PlaceVisit {
  id: string;
  entered_at: string;
  exited_at?: string;
  dwell_minutes?: number;
  day_of_week: number;
}

export interface PlaceStats {
  place: Place;
  visits: PlaceVisit[];
  average_dwell_minutes: number;
  visits_by_day: Record<number, number>;
  visits_by_hour: Record<number, number>;
  memories_count: number;
}

export interface PlaceSuggestion {
  latitude: number;
  longitude: number;
  visit_count: number;
  suggested_category: string;
  first_seen: string;
  last_seen: string;
}

export interface Routine {
  place_id: string;
  place_name: string;
  day: string;
  day_number: number;
  hour: number;
  time_display: string;
  occurrence_count: number;
  confidence: number;
  description: string;
}

export const api = {
  async chat(message: string, history: ChatMessage[] = []): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE}/chat/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversation_history: history }),
    });
    if (!res.ok) throw new Error('Chat request failed');
    return res.json();
  },

  async getMemories(limit = 20, category?: string): Promise<Memory[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (category) params.append('category', category);
    const res = await fetch(`${API_BASE}/memories/?${params}`);
    if (!res.ok) throw new Error('Failed to fetch memories');
    return res.json();
  },

  async createMemory(content: string, category = 'manual', tags: string[] = []): Promise<Memory> {
    const res = await fetch(`${API_BASE}/memories/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, category, tags }),
    });
    if (!res.ok) throw new Error('Failed to create memory');
    return res.json();
  },

  async deleteMemory(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/memories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete memory');
  },

  async searchMemories(query: string, limit = 10): Promise<string[]> {
    const res = await fetch(`${API_BASE}/memories/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) throw new Error('Failed to search memories');
    const data = await res.json();
    return data.memories;
  },

  async getTasks(status = 'pending', limit = 20): Promise<Task[]> {
    const params = new URLSearchParams({ status, limit: String(limit) });
    const res = await fetch(`${API_BASE}/tasks/?${params}`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  async getTasksDueSoon(hours = 24): Promise<Task[]> {
    const res = await fetch(`${API_BASE}/tasks/due-soon?hours=${hours}`);
    if (!res.ok) throw new Error('Failed to fetch due soon tasks');
    return res.json();
  },

  async getOverdueTasks(): Promise<Task[]> {
    const res = await fetch(`${API_BASE}/tasks/overdue`);
    if (!res.ok) throw new Error('Failed to fetch overdue tasks');
    return res.json();
  },

  async createTask(title: string, description?: string, priority = 'medium', dueAt?: string, tags: string[] = []): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, priority, due_at: dueAt, tags }),
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  },

  async completeTask(id: string): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${id}/complete`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to complete task');
    return res.json();
  },

  async deleteTask(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete task');
  },

  async getLocationContext(): Promise<LocationContext | null> {
    try {
      const res = await fetch(`${API_BASE}/overland/context`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch location context');
      return res.json();
    } catch {
      return null;
    }
  },

  async getCurrentLocation(): Promise<Location | null> {
    try {
      const res = await fetch(`${API_BASE}/overland/current`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch current location');
      return res.json();
    } catch {
      return null;
    }
  },

  async getRecentLocations(hours = 24, limit = 100): Promise<Location[]> {
    const params = new URLSearchParams({ hours: String(hours), limit: String(limit) });
    const res = await fetch(`${API_BASE}/overland/recent?${params}`);
    if (!res.ok) return [];
    return res.json();
  },

  async getMotionSummary(hours = 24): Promise<MotionSummary | null> {
    try {
      const res = await fetch(`${API_BASE}/overland/summary?hours=${hours}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async getCurationStats(userId = 'default_user'): Promise<CurationStats | null> {
    try {
      const res = await fetch(`${API_BASE}/curation/stats/${userId}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async getFlaggedMemories(userId = 'default_user', limit = 50): Promise<Memory[]> {
    const res = await fetch(`${API_BASE}/curation/flagged/${userId}?limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  },

  async runCuration(userId = 'default_user', batchSize = 20, autoDelete = false, reprocessAll = false): Promise<CurationRun | null> {
    try {
      const res = await fetch(`${API_BASE}/curation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          batch_size: batchSize,
          auto_delete: autoDelete,
          reprocess_all: reprocessAll,
        }),
      });
      if (!res.ok) throw new Error('Failed to run curation');
      return res.json();
    } catch {
      return null;
    }
  },

  async approveMemory(memoryId: string): Promise<Memory | null> {
    try {
      const res = await fetch(`${API_BASE}/curation/approve/${memoryId}`, { method: 'POST' });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async rejectMemory(memoryId: string, deletePermanently = false): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/curation/reject/${memoryId}?delete_permanently=${deletePermanently}`, {
        method: 'POST',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async rejectMemoryWithFeedback(
    memoryId: string, 
    reason: string, 
    feedback: string,
    deletePermanently = false
  ): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/curation/reject/${memoryId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          feedback,
          delete_permanently: deletePermanently,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getMemoriesForCuration(userId = 'default_user', limit = 20): Promise<Memory[]> {
    const res = await fetch(`${API_BASE}/curation/queue/${userId}?limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  },
};

export const placesApi = {
  async list(): Promise<Place[]> {
    const res = await fetch(`${API_BASE}/places/`);
    if (!res.ok) return [];
    return res.json();
  },

  async get(id: string): Promise<Place | null> {
    try {
      const res = await fetch(`${API_BASE}/places/${id}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async create(data: PlaceCreate): Promise<Place> {
    const res = await fetch(`${API_BASE}/places/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create place');
    return res.json();
  },

  async update(id: string, data: PlaceUpdate): Promise<Place> {
    const res = await fetch(`${API_BASE}/places/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update place');
    return res.json();
  },

  async delete(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/places/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  async getStats(id: string): Promise<PlaceStats | null> {
    try {
      const res = await fetch(`${API_BASE}/places/${id}/stats`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async getVisits(id: string, limit = 10): Promise<PlaceVisit[]> {
    const res = await fetch(`${API_BASE}/places/${id}/visits?limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  },

  async getCurrent(): Promise<Place | null> {
    try {
      const res = await fetch(`${API_BASE}/places/current`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async getMostVisited(limit = 5): Promise<Place[]> {
    const res = await fetch(`${API_BASE}/places/most-visited?limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  },

  async discoverPlaces(minVisits = 3, daysBack = 30): Promise<PlaceSuggestion[]> {
    const params = new URLSearchParams({ 
      min_visits: String(minVisits), 
      days_back: String(daysBack) 
    });
    const res = await fetch(`${API_BASE}/places/discover?${params}`);
    if (!res.ok) return [];
    return res.json();
  },

  async confirmDiscoveredPlace(data: PlaceCreate): Promise<Place> {
    const res = await fetch(`${API_BASE}/places/discover/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to confirm discovered place');
    return res.json();
  },

  async getRoutines(daysBack = 28): Promise<Routine[]> {
    const res = await fetch(`${API_BASE}/places/routines?days_back=${daysBack}`);
    if (!res.ok) return [];
    return res.json();
  },

  async checkRoutineDeviation(): Promise<{ is_deviation: boolean; typical_place?: string; current_place?: string; message?: string }> {
    const res = await fetch(`${API_BASE}/places/routines/deviation`);
    if (!res.ok) return { is_deviation: false };
    return res.json();
  },
};
