// ─── BLE / Network ───────────────────────────────────────────────────────────

export type BLEConnectionState =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface NodeInfo {
  deviceId: string;   // BLE device ID
  nodeId: string;     // e.g. "A2F4"
  firmwareVersion: string;
}

export type NodeStatus = 'online' | 'weak' | 'offline' | 'gateway';

export interface MeshNode {
  nodeId: string;
  status: NodeStatus;
  rssi: number;       // dBm
  hopCount: number;
  distanceKm?: number;
  // GPS coordinates (from node firmware broadcast)
  latitude?: number;
  longitude?: number;
  // Legacy normalized position for SVG fallback
  mapX: number;
  mapY: number;
  // Last time this node was seen/updated (Unix ms)
  lastSeenAt?: number;
}

export interface HopLink {
  fromNodeId: string; // 'you' | nodeId
  toNodeId: string;
  rssi: number;
  isGateway?: boolean;
}

export interface NetworkStatus {
  rssi: number;
  hopCount: number;
  gatewayReachable: boolean;
  totalDistanceKm: number;
  nodes: MeshNode[];
  links: HopLink[];
  hopChain: string[]; // e.g. ['you', 'B91C', 'D7E2', 'GW-01']
}

// ─── Supply Request ──────────────────────────────────────────────────────────

export type SupplyType = 'water' | 'food' | 'medical' | 'shelter' | 'supplies' | 'other';

export type MedicalConditionType = 'injury' | 'chronic' | 'disability' | 'medication' | 'mental' | 'other';

export interface MedicalDetail {
  conditionType: MedicalConditionType | null;
  specificNeed: string;
}

export interface MedicalDetailsState {
  adults: MedicalDetail | null;
  children: MedicalDetail | null;
  elderly: MedicalDetail | null;
}

export type UrgencyLevel = 'low' | 'medium' | 'high';

export type RequestStatus =
  | 'draft'
  | 'pending'     // queued, not yet sent
  | 'sent'        // written to BLE node
  | 'relayed'     // node confirmed first hop
  | 'received'    // gateway confirmed receipt
  | 'failed';

export interface PeopleCount {
  adults: number;
  children: number;
  elderly: number;
}

export interface SupplyRequest {
  id: string;
  createdAt: number;    // Unix ms timestamp
  updatedAt: number;

  // Form fields
  supplyTypes: SupplyType[];
  people: PeopleCount;
  additionalInfo: string;

  // Medical details (populated when medical supply type is selected)
  medicalDetails?: MedicalDetailsState;

  // Auto-captured
  latitude: number | null;
  longitude: number | null;

  // Delivery tracking
  status: RequestStatus;
  sentAt?: number;
  relayedAt?: number;
  relayNodeId?: string;
  receivedAt?: number;
  retryCount: number;
}

// ─── Gateway Messages ─────────────────────────────────────────────────────────

export type GatewayMessageType = 'info' | 'action' | 'urgent';

export interface GatewayMessage {
  id: string;
  timestamp: number;
  fromNodeId: string;   // e.g. "GW-01"
  content: string;
  type: GatewayMessageType;
  read?: boolean;
}

export interface RequestAck {
  requestId: string;
  status: 'relayed' | 'received';
  relayNodeId?: string;
  timestamp: number;
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export const SUPPLY_TYPE_LABELS: Record<SupplyType, string> = {
  water: 'Water',
  food: 'Food',
  medical: 'Medical',
  shelter: 'Shelter',
  supplies: 'Supplies',
  other: 'Other',
};

export const SUPPLY_TYPE_EMOJI: Record<SupplyType, string> = {
  water: '💧',
  food: '🍎',
  medical: '🧰',
  shelter: '🏠',
  supplies: '📦',
  other: '✏️',
};

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};
