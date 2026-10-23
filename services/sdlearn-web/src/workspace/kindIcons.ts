import {
  Activity, Archive, Clock, Cog, Cpu, Database, Earth, Fingerprint, Gauge, GitFork, Globe, Inbox, MonitorSmartphone, Plug, Radio, Search,
  ShieldCheck, Shuffle, Sparkles, Split, Table2, Warehouse, Waves, Zap, type LucideIcon,
} from 'lucide-react';
import type { ComponentKind } from '../types';

export const kindIcons: Record<ComponentKind, LucideIcon> = {
  client: MonitorSmartphone,
  dns: Globe,
  cdn: Earth,
  'load-balancer': Split,
  'api-gateway': ShieldCheck,
  'rate-limiter': Gauge,
  service: Cpu,
  websocket: Radio,
  worker: Cog,
  scheduler: Clock,
  cache: Zap,
  sql: Table2,
  nosql: Database,
  'object-storage': Archive,
  search: Search,
  queue: Inbox,
  stream: Waves,
  external: Plug,
  auth: Fingerprint,
  workflow: GitFork,
  'stream-processor': Shuffle,
  'data-warehouse': Warehouse,
  'vector-db': Sparkles,
  observability: Activity,
};
