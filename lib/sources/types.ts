import type { DiscoveredSource } from "@/lib/types";

export interface DiscoveryContext {
  domain: string;
  interests: string[];
  maxItemsPerSource: number;
}

export interface SourceAdapter {
  name: string;
  discover(context: DiscoveryContext): Promise<DiscoveredSource[]>;
}
