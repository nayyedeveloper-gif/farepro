export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  channels: { name: string; description: string }[];
}

/** Taxi / delivery focused — retail & other verticals deferred */
export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: 'transportation',
    name: 'Kilo Taxi stand',
    description: 'Built for stand owners — dispatch radio, on-duty drivers, jobs, and roadside emergencies',
    channels: [
      { name: 'Dispatch', description: 'Central dispatch coordination' },
      { name: 'Drivers On Duty', description: 'Active drivers' },
      { name: 'Jobs', description: 'Trip assignments and pickups' },
      { name: 'Maintenance', description: 'Vehicle maintenance' },
      { name: 'Emergency', description: 'Road incidents' },
    ],
  },
  {
    id: 'general',
    name: 'Other fleet',
    description: 'Delivery, logistics, or mixed teams that still need push-to-talk',
    channels: [
      { name: 'All Staff', description: 'Company-wide announcements' },
      { name: 'Dispatch', description: 'Operations coordination' },
      { name: 'Emergency', description: 'Urgent alerts' },
    ],
  },
];

