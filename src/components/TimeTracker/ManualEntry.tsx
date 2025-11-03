import React, { useState } from 'react';
import { Button, Input, DatePicker, Popup, Space } from 'antd-mobile';
import { useEntryStore } from '../../stores/entryStore';
import dayjs from 'dayjs';

export const ManualEntry: React.FC = () => {
  const { addEntry } = useEntryStore();
  const [visible, setVisible] = useState(false);
  const [activity, setActivity] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);

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

  const handleSubmit = async () => {
    if (!activity.trim() || !startTime || !endTime) {
      return;
    }

    if (endTime <= startTime) {
      alert('结束时间必须晚于开始时间');
      return;
    }

    await addEntry({
      startTime,
      endTime,
      activity,
      goalId: null
    });

    setActivity('');
    setStartTime(new Date());
    setEndTime(new Date());
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
        bodyStyle={{ height: '70vh' }}
      >
        <div style={{ padding: '16px' }}>
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

            <Space style={{ width: '100%', marginTop: '16px' }} block>
              <Button
                block
                color="primary"
                onClick={handleSubmit}
                disabled={!activity.trim()}
              >
                保存
              </Button>
              <Button
                block
                onClick={() => setVisible(false)}
              >
                取消
              </Button>
            </Space>
          </Space>
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
