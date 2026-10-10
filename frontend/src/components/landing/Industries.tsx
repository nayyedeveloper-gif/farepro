import React from 'react';
import Navbar from './Navbar';
import { AviationIcon, TransportIcon, ConstructionIcon, ManufacturingIcon, HospitalityIcon, EmergencyIcon, RetailIcon } from '../icons/Icons';

const INDUSTRIES = [
  { icon: AviationIcon, title: 'Aviation', desc: 'Coordinate ground crews and dispatch with instant voice.' },
  { icon: TransportIcon, title: 'Transportation', desc: 'Track fleets in real-time and communicate on the move.' },
  { icon: ConstructionIcon, title: 'Construction', desc: 'Connect site teams and supervisors with reliable voice channels.' },
  { icon: ManufacturingIcon, title: 'Manufacturing', desc: 'Streamline floor operations with push-to-talk communication.' },
  { icon: HospitalityIcon, title: 'Hospitality', desc: 'Coordinate staff across properties and venues instantly.' },
  { icon: EmergencyIcon, title: 'Emergency Services', desc: 'Reliable communication for first responders and dispatchers.' },
  { icon: RetailIcon, title: 'Retail', desc: 'Connect store teams and distribution centers seamlessly.' },
];

const Industries: React.FC = () => {
  return (
    <div className="tl-landing">
      <Navbar />
      <section className="tl-page-header">
        <div className="tl-page-inner">
          <h1>Industries we serve</h1>
          <p>TeamLink powers fleet communication across industries worldwide.</p>
        </div>
      </section>
      <section className="tl-page-body">
        <div className="tl-page-inner">
          <div className="tl-industries-grid">
            {INDUSTRIES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="tl-industry-card">
                  <Icon size={32} />
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Industries;
