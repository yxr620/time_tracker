import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button, Input, DatePicker, Popup, Space, Selector, Toast } from 'antd-mobile';
import { useEntryStore } from '../../stores/entryStore';
import { useGoalStore } from '../../stores/goalStore';
import { useCategoryStore } from '../../stores/categoryStore';
import dayjs from 'dayjs';

interface ManualEntryProps {
  hideButton?: boolean;
}

export interface ManualEntryRef {
  open: () => void;
}

export const ManualEntry = forwardRef<ManualEntryRef, ManualEntryProps>(({ hideButton = false }, ref) => {
  const { addEntry } = useEntryStore();
  const { goals, loadGoals } = useGoalStore();
  const { categories, loadCategories } = useCategoryStore();
  const [visible, setVisible] = useState(false);
  const [activity, setActivity] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => setVisible(true)
  }));

  useEffect(() => {
    if (visible) {
      loadGoals();
      loadCategories();
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

  // 获取当前日期和昨天的目标
  const today = dayjs(startTime).format('YYYY-MM-DD');
  const yesterday = dayjs(startTime).subtract(1, 'day').format('YYYY-MM-DD');
  
  const todayGoals = goals.filter(g => g.date === today);
  const yesterdayGoals = goals.filter(g => g.date === yesterday);
  
  // 过滤掉与今天目标重复的昨天目标（忽略大小写）
  const todayGoalNamesLower = todayGoals.map(g => g.name.toLowerCase().trim());
  const filteredYesterdayGoals = yesterdayGoals.filter(
    g => !todayGoalNamesLower.includes(g.name.toLowerCase().trim())
  );
  
  const currentDateGoals = [...todayGoals, ...filteredYesterdayGoals];

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
      categoryId: selectedCategoryId || null,
      goalId: selectedGoalId
    });

    Toast.show({
      icon: 'success',
      content: '记录已添加'
    });

    setActivity('');
    setStartTime(new Date());
    setEndTime(new Date());
    setSelectedCategoryId('');
    setSelectedGoalId(null);
    setVisible(false);
  };

  return (
    <>
      {!hideButton && (
        <Button
          block
          color="default"
          size="large"
          onClick={() => setVisible(true)}
        >
          手动添加记录
        </Button>
      )}

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
              <div style={{ marginBottom: '4px', fontWeight: '500', fontSize: '13px' }}>类别（可选）</div>
              <Selector
                options={[
                  { label: '无分类', value: '' },
                  ...categories.map(c => ({
                    label: c.name,
                    value: c.id
                  }))
                ]}
                value={[selectedCategoryId]}
                onChange={(arr) => setSelectedCategoryId(arr[0] as string)}
                style={{
                  '--border-radius': '6px',
                  '--border': '1px solid #d9d9d9',
                  '--checked-border': '1px solid #1677ff',
                  '--checked-color': '#fff',
                  '--padding': '6px 10px',
                  '--font-size': '13px'
                } as React.CSSProperties}
              />
            </div>

            <div>
              <div style={{ marginBottom: '4px', fontWeight: '500', fontSize: '13px' }}>关联目标（可选）</div>
              {currentDateGoals.length > 0 ? (
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
                    '--border-radius': '6px',
                    '--border': '1px solid #d9d9d9',
                    '--checked-border': '1px solid #1677ff',
                    '--checked-color': '#fff',
                    '--padding': '6px 10px',
                    '--font-size': '13px'
                  } as React.CSSProperties}
                />
              ) : (
                <div style={{ color: '#999', fontSize: '12px', padding: '4px 0' }}>
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
});
