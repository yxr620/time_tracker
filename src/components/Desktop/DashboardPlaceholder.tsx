import React from 'react';
import { Card } from 'antd-mobile';

export const DashboardPlaceholder: React.FC = () => {
  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto', background: '#f5f5f5' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px', color: '#333' }}>📊 数据分析中心</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <Card title="本周概览">
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: '8px' }}>
            <span style={{ color: '#999' }}>图表开发中...</span>
          </div>
        </Card>

        <Card title="目标进度">
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: '8px' }}>
            <span style={{ color: '#999' }}>图表开发中...</span>
          </div>
        </Card>

        <Card title="分类统计">
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: '8px' }}>
            <span style={{ color: '#999' }}>图表开发中...</span>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: '40px', padding: '20px', background: '#e6f7ff', borderRadius: '8px', border: '1px solid #91d5ff' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#0050b3' }}>💡 开发提示</h3>
        <p style={{ color: '#003a8c' }}>
          这是电脑端的专属分析面板。
          <br />
          左侧保留了手机端的所有功能（记录、同步、设置）。
          <br />
          右侧将用来移植 Python 分析软件的功能。
          <br />
          数据是完全互通的，因为它们读取同一个 IndexedDB 数据库。
        </p>
      </div>
    </div>
  );
};
