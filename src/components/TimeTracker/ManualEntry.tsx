import React, { useState, useEffect } from 'react';
import { Button, Input, DatePicker, Popup, Space, Selector, Toast } from 'antd-mobile';
import { useEntryStore } from '../../stores/entryStore';
import { useGoalStore } from '../../stores/goalStore';
import dayjs from 'dayjs';

export const ManualEntry: React.FC = () => {
  const { addEntry } = useEntryStore();
  const { goals, loadGoals } = useGoalStore();
  const [visible, setVisible] = useState(false);
  const [activity, setActivity] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      loadGoals();
    }
  }, [visible]);

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

  // 获取当前日期的目标
  const currentDateGoals = goals.filter(g => 
    g.date === dayjs(startTime).format('YYYY-MM-DD')
  );

  const handleSubmit = async () => {
    if (!activity.trim() || !startTime || !endTime) {
      Toast.show({
        icon: 'fail',
        content: '请填写完整信息'
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
      goalId: selectedGoalId
    });

    Toast.show({
      icon: 'success',
      content: '记录已添加'
    });

    setActivity('');
    setStartTime(new Date());
    setEndTime(new Date());
    setSelectedGoalId(null);
    setVisible(false);
  };

  return (
    <>
      <Button
        block
        color="default"
        size="large"
        onClick={() => setVisible(true)}
      >
        手动添加记录
      </Button>

      <Popup
        visible={visible}
        onMaskClick={() => setVisible(false)}
        bodyStyle={{ 
          height: '70vh',
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
          <Space direction="vertical" style={{ width: '100%' }} block>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
              手动添加记录
            </div>

            <div>
              <div style={{ marginBottom: '8px', fontWeight: '500' }}>活动名称</div>
              <Input
                placeholder="输入活动名称..."
                value={activity}
                onChange={setActivity}
                clearable
              />
            </div>

            <div>
              <div style={{ marginBottom: '8px', fontWeight: '500' }}>关联目标（可选）</div>
              {currentDateGoals.length > 0 ? (
                <Selector
                  options={[
                    { label: '无', value: '' },
                    ...currentDateGoals.map(g => ({
                      label: g.name,
                      value: g.id!
                    }))
                  ]}
                  value={[selectedGoalId || '']}
                  onChange={(arr) => setSelectedGoalId(arr[0] === '' ? null : arr[0] as string)}
                />
              ) : (
                <div style={{ color: '#999', fontSize: '14px' }}>
                  该日期暂无目标，请先在目标页面创建
                </div>
              )}
            </div>

            <div>
              <div style={{ marginBottom: '8px', fontWeight: '500' }}>开始时间</div>
              <Button
                block
                onClick={() => setStartPickerVisible(true)}
              >
                {dayjs(startTime).format('YYYY-MM-DD HH:mm')}
              </Button>
              <Space style={{ marginTop: '8px' }} wrap>
                {quickTimeButtons.map(btn => (
                  <Button
                    key={btn.label}
                    size="small"
                    onClick={() => setQuickTime(btn.minutes, true)}
                  >
                    {btn.label}
                  </Button>
                ))}
              </Space>
            </div>

            <div>
              <div style={{ marginBottom: '8px', fontWeight: '500' }}>结束时间</div>
              <Button
                block
                onClick={() => setEndPickerVisible(true)}
              >
                {dayjs(endTime).format('YYYY-MM-DD HH:mm')}
              </Button>
              <Space style={{ marginTop: '8px' }} wrap>
                {quickTimeButtons.map(btn => (
                  <Button
                    key={btn.label}
                    size="small"
                    onClick={() => setQuickTime(btn.minutes, false)}
                  >
                    {btn.label}
                  </Button>
                ))}
              </Space>
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
              onClick={() => setVisible(false)}
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
        value={endTime}
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
