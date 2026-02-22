import React from 'react';
import { IonIcon } from '@ionic/react';
import { 
  checkmarkDoneOutline, 
  barChartOutline,
  sparklesOutline,
  settingsOutline
} from 'ionicons/icons';
import recordsIcon from '../../assets/recordsIcon.png';
import './DesktopSidebar.css';

interface DesktopSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface NavItem {
  key: string;
  icon: any;
  label: string;
  isImage?: boolean;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ activeTab, onTabChange }) => {
  const navItems: NavItem[] = [
    { key: 'dashboard', icon: barChartOutline, label: '分析' },
    { key: 'records', icon: recordsIcon, label: '记录', isImage: true },
    { key: 'goals', icon: checkmarkDoneOutline, label: '目标' },
    { key: 'ai', icon: sparklesOutline, label: 'AI' },
    { key: 'export', icon: settingsOutline, label: '设置' },
  ];

  return (
    <div className="desktop-sidebar">
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`sidebar-nav-item ${activeTab === item.key ? 'active' : ''}`}
            onClick={() => onTabChange(item.key)}
          >
            {item.isImage ? (
              <img src={item.icon} alt="" className="sidebar-nav-icon" style={{ width: '24px', height: '24px' }} />
            ) : (
              <IonIcon icon={item.icon} className="sidebar-nav-icon" />
            )}
            <span className="sidebar-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
