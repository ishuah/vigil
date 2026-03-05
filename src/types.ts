export interface Credentials {
  email: string;
  apiKey: string;
}

export interface ACLEDEvent {
  event_id_cnty: string;
  event_date: string;
  year: string;
  event_type: string;
  sub_event_type: string;
  actor1: string;
  assoc_actor_1: string;
  inter1: number;
  actor2: string;
  assoc_actor_2: string;
  inter2: number;
  interaction: string;
  country: string;
  admin1: string;
  admin2: string;
  admin3: string;
  location: string;
  latitude: string;
  longitude: string;
  geo_precision: string;
  source: string;
  notes: string;
  fatalities: number;
  timestamp: string;
}

export interface Actor {
  id: string;
  name: string;
  interCode: number;
  eventCount: number;
  events: ACLEDEvent[];
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  source: string | Actor;
  target: string | Actor;
  events: ACLEDEvent[];
  weight: number;
  dominantEventType: string;
}

export interface FilterState {
  countries: string[];
  startDate: string;
  endDate: string;
  eventTypes: string[];
  minInteractions: number;
  maxActors: number;
}

export interface GraphData {
  actors: Actor[];
  edges: GraphEdge[];
}
