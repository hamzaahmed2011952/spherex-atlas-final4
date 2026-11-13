import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DeepSpaceBackdrop } from './components/layout/DeepSpaceBackdrop';
import { MissionDashboard } from './components/modules/MissionDashboard';
import { SkyExplorer } from './components/modules/SkyExplorer';
import { FitsLab } from './components/modules/FitsLab';
import { TargetIntelligence } from './components/modules/TargetIntelligence';
import { SpectralStudio } from './components/modules/SpectralStudio';
import { ObservationTimeline } from './components/modules/ObservationTimeline';
import { ImageComparison } from './components/modules/ImageComparison';
import { MultiDatasets } from './components/modules/MultiDatasets';
import { AiAssistant } from './components/modules/AiAssistant';
import { ResearchWorkspace } from './components/modules/ResearchWorkspace';
import { ReportGenerator } from './components/modules/ReportGenerator';
import { ExternalLink, Telescope } from 'lucide-react';

const MainContent: React.FC = () => {
  const { activeModule } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderModule = () => {
    switch (activeModule) {
      case 'mission':
        return <MissionDashboard />;
      case 'sky':
        return <SkyExplorer />;
      case 'fits':
        return <FitsLab />;
      case 'targets':
        return <TargetIntelligence />;
      case 'spectra':
        return <SpectralStudio />;
      case 'timeline':
        return <ObservationTimeline />;
      case 'comparison':
        return <ImageComparison />;
      case 'datasets':
        return <MultiDatasets />;
      case 'assistant':
        return <AiAssistant />;
      case 'workspace':
        return <ResearchWorkspace />;
      case 'reports':
        return <ReportGenerator />;
      default:
        return <MissionDashboard />;
    }
  };

  return (
    <div className="min-h-screen cosmic-backdrop text-slate-100 flex flex-col relative selection:bg-cyan-500/30 selection:text-cyan-100">
      <DeepSpaceBackdrop />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className="flex-1 flex max-w-[1440px] w-full mx-auto">
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-7 overflow-x-hidden">
            <div key={activeModule} className="module-enter">
              {renderModule()}
            </div>
          </main>
        </div>

        <footer className="no-print border-t border-cyan-500/15 bg-[#040816]/80 backdrop-blur-md py-4 px-4 sm:px-6 text-xs text-slate-400">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
              <Telescope size={14} className="text-cyan-400 shrink-0" />
              <span className="font-semibold text-slate-200">SPHEREx ATLAS</span>
              <span aria-hidden="true">·</span>
              <span>NASA Astrophysics MIDEX Exploration Platform</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono">
              <a
                href="https://science.nasa.gov/mission/spherex/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                <span>NASA SPHEREx</span>
                <ExternalLink size={11} />
              </a>
              <a
                href="https://irsa.ipac.caltech.edu/Missions/spherex.html"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                <span>IPAC IRSA Archive</span>
                <ExternalLink size={11} />
              </a>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span>JPL / Caltech / NASA</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
