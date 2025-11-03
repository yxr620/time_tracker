import React, { useState, useEffect } from 'react';
import { Button, Input, DatePicker, Popup, Space, Selector } from 'antd-mobile';
import { useGoalStore } from '../../stores/goalStore';
import type { TimeEntry } from '../../services/db';
import dayjs from 'dayjs';

interface EditEntryDialogProps {
  entry: TimeEntry | null;
  visible: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<TimeEntry>) => Promise<void>;
}

export const EditEntryDialog: React.FC<EditEntryDialogProps> = ({
  entry,
  visible,
  onClose,
  onSave
}) => {
  const { goals, loadGoals } = useGoalStore();
  const [activity, setActivity] = useState('');
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      loadGoals();
    }
  }, [visible]);

  useEffect(() => {
    if (entry) {
      setActivity(entry.activity);
      setStartTime(entry.startTime);
      setEndTime(entry.endTime);
      setSelectedGoalId(entry.goalId || null);
    }
  }, [entry]);

  // 获取记录日期的目标
  const entryDateGoals = entry 
    ? goals.filter(g => g.date === dayjs(entry.startTime).format('YYYY-MM-DD'))
    : [];

  const handleSubmit = async () => {
    if (!entry?.id || !activity.trim()) {
      return;
    }

    if (endTime && endTime <= startTime) {
      alert('结束时间必须晚于开始时间');
      return;
    }

    await onSave(entry.id, {
      activity,
      startTime,
      endTime,
      goalId: selectedGoalId
    });

    onClose();
  };

  const quickTimeButtons = [
    { label: '现在', minutes: 0 },
    { label: '5分钟前', minutes: -5 },
    { label: '15分钟前', minutes: -15 },
    { label: '30分钟前', minutes: -30 }
  ];

  const setQuickTime = (minutes: number, isStart: boolean) => {
    const time = dayjs().add(minutes, 'minute').toDate();
    if (isStart) {
      setStartTime(time);
    } else {
      setEndTime(time);
    }
  };

  if (!entry) return null;

  return (
    <>
    <Popup
      visible={visible}
      onMaskClick={onClose}
      bodyStyle={{ 
        height: '80vh', 
        borderTopLeftRadius: '8px', 
        borderTopRightRadius: '8px',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        padding: '16px',
        paddingBottom: '0'
      }}>
        <h3 style={{ marginBottom: '16px' }}>编辑记录</h3>

        <Space direction="vertical" style={{ width: '100%' }} block>
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>活动名称</div>
            <Input
              placeholder="输入活动名称"
              value={activity}
              onChange={setActivity}
            />
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>关联目标</div>
            {entryDateGoals.length > 0 ? (
              <Selector
                options={[
                  { label: '无', value: '' },
                  ...entryDateGoals.map(g => ({
                    label: g.name,
                    value: g.id!
                  }))
                ]}
                value={[selectedGoalId || '']}
                onChange={(arr) => setSelectedGoalId(arr[0] === '' ? null : arr[0] as string)}
              />
            ) : (
              <div style={{ color: '#999', fontSize: '14px', padding: '8px' }}>
                该日期暂无目标
              </div>
            )}
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>开始时间</div>
            <Button 
              block 
              onClick={() => setStartPickerVisible(true)}
            >
              {dayjs(startTime).format('YYYY-MM-DD HH:mm')}
            </Button>
            <div style={{ marginTop: '8px' }}>
              <Space wrap>
                {quickTimeButtons.map(btn => (
                  <Button
                    key={btn.label}
                    size="small"
                    fill="outline"
                    onClick={() => setQuickTime(btn.minutes, true)}
                  >
                    {btn.label}
                  </Button>
                ))}
              </Space>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>结束时间</div>
            <Button 
              block 
              onClick={() => setEndPickerVisible(true)}
            >
              {endTime ? dayjs(endTime).format('YYYY-MM-DD HH:mm') : '进行中'}
            </Button>
            <div style={{ marginTop: '8px' }}>
              <Space wrap>
                {quickTimeButtons.map(btn => (
                  <Button
                    key={btn.label}
                    size="small"
                    fill="outline"
                    onClick={() => setQuickTime(btn.minutes, false)}
                  >
                    {btn.label}
                  </Button>
                ))}
                <Button
                  size="small"
                  fill="outline"
                  color="warning"
                  onClick={() => setEndTime(null)}
                >
                  设为进行中
                </Button>
              </Space>
            </div>
          </div>

        </Space>
      </div>
      
      <div style={{ 
        padding: '16px',
        borderTop: '1px solid #f0f0f0',
        backgroundColor: 'white'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button
            color="default"
            size="large"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            color="primary"
            size="large"
            style={{ flex: 1 }}
            onClick={handleSubmit}
            disabled={!activity.trim()}
          >
            保存
          </Button>
        </div>
      </div>
    </Popup>

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
    </>
  );
};
