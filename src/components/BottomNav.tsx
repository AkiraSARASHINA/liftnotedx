import { NavLink } from 'react-router-dom';
import { PlusCircle, Calendar, BarChart2, Settings } from 'lucide-react';
import './BottomNav.css';

const BottomNav: React.FC = () => {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <PlusCircle size={24} />
        <span>登録</span>
      </NavLink>
      <NavLink to="/calendar" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Calendar size={24} />
        <span>記録</span>
      </NavLink>
      <NavLink to="/charts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <BarChart2 size={24} />
        <span>分析</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Settings size={24} />
        <span>設定</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
