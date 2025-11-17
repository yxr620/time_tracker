import React, { useState, useEffect } from 'react';
import { Button, Input, DatePicker, Space, Selector, Toast } from 'antd-mobile';
import { useEntryStore } from '../../stores/entryStore';
import { useGoalStore } from '../../stores/goalStore';
import { useCategoryStore } from '../../stores/categoryStore';
import dayjs from 'dayjs';

export const TimeEntryForm: React.FC = () => {
  const { currentEntry, startTracking, stopTracking, addEntry, nextStartTime, setNextStartTime } = useEntryStore();
  const { goals, loadGoals } = useGoalStore();
  const { categories, loadCategories } = useCategoryStore();
  
  const [activity, setActivity] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    loadGoals();
    loadCategories();
  }, []);

  // 当从记录列表或时间轴点击时，自动设置开始时间
  useEffect(() => {
    if (nextStartTime) {
      setStartTime(nextStartTime);
      setNextStartTime(null);
    }
  }, [nextStartTime]);

  // 更新计时器显示
  useEffect(() => {
    if (!currentEntry) {
      setElapsed('00:00:00');
      return;
    }

    const timer = setInterval(() => {
      const now = dayjs();
      const start = dayjs(currentEntry.startTime);
      const diff = now.diff(start, 'second');
      
      const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');
      
      setElapsed(`${hours}:${minutes}:${seconds}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [currentEntry]);

  // 获取今天和昨天的目标
  const today = dayjs().format('YYYY-MM-DD');
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  
  const todayGoals = goals.filter(g => g.date === today);
  const yesterdayGoals = goals.filter(g => g.date === yesterday);
  
  // 过滤掉与今天目标重复的昨天目标
  const todayGoalNamesLower = todayGoals.map(g => g.name.toLowerCase().trim());
  const filteredYesterdayGoals = yesterdayGoals.filter(
    g => !todayGoalNamesLower.includes(g.name.toLowerCase().trim())
  );
  
  const availableGoals = [...todayGoals, ...filteredYesterdayGoals];

  // 设置结束时间为"正在进行"
  const setEndTimeToOngoing = () => {
    setEndTime(null);
    Toast.show({
      icon: 'success',
      content: '已设置为正在进行'
    });
  };

  // 设置当前时间
  const setToNow = (isStart: boolean) => {
    const now = new Date();
    if (isStart) {
      setStartTime(now);
    } else {
      setEndTime(now);
    }
  };

  // 开始计时（正在进行）
  const handleStartTracking = async () => {
    if (!activity.trim()) {
      Toast.show({
        icon: 'fail',
        content: '请输入活动名称'
      });
      return;
    }

    await startTracking(
      activity,
      selectedGoalId || undefined,
      startTime,
      selectedCategoryId || undefined
    );

    Toast.show({
      icon: 'success',
      content: '开始计时'
    });

    // 清空表单
    setActivity('');
    setSelectedCategoryId('');
    setSelectedGoalId(null);
    setStartTime(new Date());
    setEndTime(null);
  };

  // 停止当前计时
  const handleStopTracking = async () => {
    await stopTracking();
    Toast.show({
      icon: 'success',
      content: '已停止计时'
    });
  };

  // 保存手动添加的记录
  const handleSaveManualEntry = async () => {
    if (!activity.trim()) {
      Toast.show({
        icon: 'fail',
        content: '请输入活动名称'
      });
      return;
    }

    if (!endTime) {
      Toast.show({
        icon: 'fail',
        content: '请设置结束时间或使用"开始计时"'
      });
      return;
    }

    if (endTime <= startTime) {
      Toast.show({
        icon: 'fail',
        content: '结束时间必须晚于开始时间'
      });
      return;
    }

    await addEntry({
      startTime,
      endTime,
      activity,
      categoryId: selectedCategoryId || null,
      goalId: selectedGoalId
    });

    Toast.show({
      icon: 'success',
      content: '记录已保存'
    });

    // 清空表单
    setActivity('');
    setSelectedCategoryId('');
    setSelectedGoalId(null);
    setStartTime(new Date());
    setEndTime(null);
  };

  // 如果正在计时，显示计时器界面
  if (currentEntry) {
    return (
      <div style={{ 
        padding: '12px', 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '8px',
        color: 'white'
      }}>
        <Space direction="vertical" style={{ width: '100%' }} block>
          <div style={{ fontSize: '14px', fontWeight: 'bold', opacity: 0.9 }}>
            正在追踪
          </div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '2px' }}>
            {currentEntry.activity}
          </div>
          <div style={{ 
            fontSize: '36px', 
            fontWeight: 'bold', 
            textAlign: 'center', 
            margin: '12px 0',
            fontFamily: 'monospace',
            letterSpacing: '2px'
          }}>
            {elapsed}
          </div>
          <Button
            block
            size="middle"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: 'none',
              fontWeight: 'bold'
            }}
            onClick={handleStopTracking}
          >
            停止计时
          </Button>
        </Space>
      </div>
    );
  }

  // 正常的录入界面
  return (
    <div style={{ padding: '0 12px' }}>
      <Space direction="vertical" style={{ width: '100%', '--gap': '12px' }} block>
        <div style={{ 
          background: '#ffffff',
          padding: '12px',
          borderRadius: '16px',
          border: '1.5px solid #d0d0d0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
        }}>
          <Input
            placeholder="输入活动名称"
            value={activity}
            onChange={setActivity}
            clearable
            style={{
              '--font-size': '16px',
              '--text-align': 'left',
              '--placeholder-color': '#999',
              '--color': '#333',
              fontWeight: '500'
            } as React.CSSProperties}
          />
        </div>
        
        <div>
          <div style={{ marginBottom: '4px', fontWeight: '600', fontSize: '12px', color: '#666' }}>类别</div>
          <Selector
            options={[
              { label: '无', value: '' },
              ...categories.map(c => ({
                label: c.name,
                value: c.id
              }))
            ]}
            value={[selectedCategoryId]}
            onChange={(arr) => setSelectedCategoryId(arr[0] as string)}
            style={{
              '--border-radius': '4px',
              '--border': '1px solid #e0e0e0',
              '--checked-border': '1px solid #667eea',
              '--checked-color': '#667eea',
              '--padding': '4px 8px',
              '--font-size': '11px'
            } as React.CSSProperties}
          />
        </div>
        
        <div>
          <div style={{ marginBottom: '4px', fontWeight: '600', fontSize: '12px', color: '#666' }}>关联目标</div>
          {availableGoals.length > 0 ? (
            <Selector
              options={[
                { label: '无', value: '' },
                ...todayGoals.map(g => ({
                  label: `${g.name}`,
                  value: g.id!
                })),
                ...filteredYesterdayGoals.map(g => ({
                  label: `${g.name}*`,
                  value: g.id!
                }))
              ]}
              value={[selectedGoalId || '']}
              onChange={(arr) => setSelectedGoalId(arr[0] === '' ? null : arr[0] as string)}
              style={{
                '--border-radius': '4px',
                '--border': '1px solid #e0e0e0',
                '--checked-border': '1px solid #667eea',
                '--checked-color': '#667eea',
                '--padding': '4px 8px',
                '--font-size': '11px'
              } as React.CSSProperties}
            />
          ) : (
            <div style={{ color: '#999', fontSize: '12px', padding: '4px 0' }}>
              今天暂无目标
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          {/* 开始时间列 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: '6px', fontWeight: '600', fontSize: '12px', color: '#666', textAlign: 'center' }}>开始时间</div>
            <Button
              onClick={() => setStartPickerVisible(true)}
              style={{
                width: '80%',
                height: '32px',
                fontSize: '14px',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {dayjs(startTime).format('MM-DD HH:mm')}
            </Button>
            <Button
              size="small"
              fill="outline"
              onClick={() => setToNow(true)}
              style={{ fontSize: '12px', padding: '4px 8px', width: '80%' }}
            >
              现在
            </Button>
          </div>

          {/* 结束时间列 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '6px', fontWeight: '600', fontSize: '12px', color: '#666', textAlign: 'center' }}>结束时间</div>
            <Button
              onClick={() => setEndPickerVisible(true)}
              style={{
                width: '80%',
                height: '32px',
                fontSize: '14px',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'flex-start'
              }}
            >
              {endTime ? dayjs(endTime).format('MM-DD HH:mm') : '正在进行'}
            </Button>
            <Space style={{ width: '80%', '--gap': '6px' }}>
              <Button
                size="small"
                fill="outline"
                onClick={() => setToNow(false)}
                style={{ fontSize: '12px', padding: '4px 8px', flex: 1 }}
              >
                现在
              </Button>
              <Button
                size="small"
                fill="outline"
                color="warning"
                onClick={setEndTimeToOngoing}
                style={{ fontSize: '12px', padding: '4px 8px', flex: 1 }}
              >
                正在进行
              </Button>
            </Space>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          {endTime === null ? (
            <Button
              block
              color="primary"
              size="middle"
              onClick={handleStartTracking}
              disabled={!activity.trim()}
            >
              开始计时
            </Button>
          ) : (
            <Button
              block
              color="primary"
              size="middle"
              onClick={handleSaveManualEntry}
              disabled={!activity.trim()}
            >
              保存记录
            </Button>
          )}
        </div>
      </Space>

      <DatePicker
        visible={startPickerVisible}
        onClose={() => setStartPickerVisible(false)}
        value={startTime}
        onConfirm={val => {
          setStartTime(val);
        }}
        precision="minute"
        renderLabel={(type, data) => {
          switch (type) {
            case 'year':
              return data + '年';
            case 'month':
              return data + '月';
            case 'day':
              return data + '日';
            case 'hour':
              return data + '时';
            case 'minute':
              return data + '分';
            default:
              return data;
          }
        }}
      >
        {() => null}
      </DatePicker>

      <DatePicker
        visible={endPickerVisible}
        onClose={() => setEndPickerVisible(false)}
        value={endTime || new Date()}
        onConfirm={val => {
          setEndTime(val);
        }}
        precision="minute"
        renderLabel={(type, data) => {
          switch (type) {
            case 'year':
              return data + '年';
            case 'month':
              return data + '月';
            case 'day':
              return data + '日';
            case 'hour':
              return data + '时';
            case 'minute':
              return data + '分';
            default:
              return data;
          }
        }}
      >
        {() => null}
      </DatePicker>
    </div>
  );
};
