import React, { useState, useEffect } from 'react';
import { Button, Input, DatePicker, Popup, Space, Selector, Toast } from 'antd-mobile';
import { useGoalStore } from '../../stores/goalStore';
import { useCategoryStore } from '../../stores/categoryStore';
import { useEntryStore } from '../../stores/entryStore';
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
  const { entries } = useEntryStore();
  const { goals, loadGoals } = useGoalStore();
  const { categories, loadCategories } = useCategoryStore();
  const [activity, setActivity] = useState('');
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      loadGoals();
      loadCategories();
    }
  }, [visible]);

  useEffect(() => {
    if (entry) {
      setActivity(entry.activity);
      setStartTime(entry.startTime);
      setEndTime(entry.endTime);
      setSelectedCategoryId(entry.categoryId || '');
      setSelectedGoalId(entry.goalId || null);
    }
  }, [entry]);

  // 获取记录日期和昨天的目标
  const today = entry ? dayjs(entry.startTime).format('YYYY-MM-DD') : '';
  const yesterday = entry ? dayjs(entry.startTime).subtract(1, 'day').format('YYYY-MM-DD') : '';
  
  const todayGoals = entry ? goals.filter(g => g.date === today) : [];
  const yesterdayGoals = entry ? goals.filter(g => g.date === yesterday) : [];
  
  const entryDateGoals = [...todayGoals, ...yesterdayGoals];

  const handleSubmit = async () => {
    if (!entry?.id || !activity.trim()) {
      return;
    }

    if (endTime && endTime <= startTime) {
      Toast.show({
        icon: 'fail',
        content: '结束时间必须晚于开始时间'
      });
      return;
    }

    await onSave(entry.id, {
      activity,
      startTime,
      endTime,
      categoryId: selectedCategoryId || null,
      goalId: selectedGoalId
    });

    onClose();
  };

  // 获取上次记录的结束时间
  const getLastEndTime = () => {
    if (entries.length === 0) return null;
    // 排除当前正在编辑的记录
    const otherEntries = entries.filter(e => e.id !== entry?.id && e.endTime !== null);
    if (otherEntries.length === 0) return null;
    return otherEntries[0].endTime;
  };

  // 设置开始时间为"上次结束"
  const setStartTimeToLastEnd = () => {
    const lastEndTime = getLastEndTime();
    if (lastEndTime) {
      setStartTime(lastEndTime);
      Toast.show({
        icon: 'success',
        content: '已设置为上次结束时间'
      });
    } else {
      Toast.show({
        icon: 'fail',
        content: '没有找到上次记录'
      });
    }
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

  // 设置结束时间为"正在进行"
  const setEndTimeToOngoing = () => {
    setEndTime(null);
    Toast.show({
      icon: 'success',
      content: '已设置为正在进行'
    });
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
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>类别（可选）</div>
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
                '--border-radius': '8px',
                '--border': '1px solid #d9d9d9',
                '--checked-border': '1px solid #1677ff',
                '--checked-color': '#1677ff'
              }}
            />
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>关联目标</div>
            {entryDateGoals.length > 0 ? (
              <Selector
                options={[
                  { label: '无', value: '' },
                  ...todayGoals.map(g => ({
                    label: `${g.name}`,
                    value: g.id!
                  })),
                  ...yesterdayGoals.map(g => ({
                    label: `${g.name}*`,
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
                <Button
                  size="small"
                  fill="outline"
                  onClick={() => setToNow(true)}
                >
                  现在
                </Button>
                <Button
                  size="small"
                  fill="outline"
                  color="primary"
                  onClick={setStartTimeToLastEnd}
                >
                  上次结束
                </Button>
              </Space>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>结束时间</div>
            <Button 
              block 
              onClick={() => setEndPickerVisible(true)}
            >
              {endTime ? dayjs(endTime).format('YYYY-MM-DD HH:mm') : '正在进行'}
            </Button>
            <div style={{ marginTop: '8px' }}>
              <Space wrap>
                <Button
                  size="small"
                  fill="outline"
                  onClick={() => setToNow(false)}
                >
                  现在
                </Button>
                <Button
                  size="small"
                  fill="outline"
                  color="warning"
                  onClick={setEndTimeToOngoing}
                >
                  正在进行
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
