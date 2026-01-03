import React, { useState, useEffect } from 'react';
import { Button, DatePicker, Popup, Space, Toast } from 'antd-mobile';
import {
  IonCard,
  IonCardContent,
  IonItem,
  IonIcon,
  IonInput
} from '@ionic/react';
import { chatbubbleOutline, pricetagOutline, flagOutline } from 'ionicons/icons';
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
      // 确保日期是 Date 对象
      setStartTime(entry.startTime instanceof Date ? entry.startTime : new Date(entry.startTime));
      setEndTime(entry.endTime ? (entry.endTime instanceof Date ? entry.endTime : new Date(entry.endTime)) : null);
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
      // 确保是 Date 对象
      setStartTime(lastEndTime instanceof Date ? lastEndTime : new Date(lastEndTime));
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
          {/* 活动名称输入 */}
          <IonCard
            style={{
              margin: 0,
              borderRadius: '24px',
              background: 'rgba(255,255,255,0.95)',
              boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
              border: '1px solid rgba(148, 163, 184, 0.12)'
            }}>
            <IonCardContent style={{ padding: 0 }}>
              <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '20px', '--padding-end': '20px' }}>
                <IonIcon icon={chatbubbleOutline} slot="start" style={{ color: '#bbb', fontSize: '20px', marginRight: '8px' }} />
                <IonInput
                  placeholder="输入活动名称"
                  value={activity}
                  onIonInput={e => setActivity(e.detail.value!)}
                  clearInput
                  style={{
                    fontSize: '17px',
                    fontWeight: '500',
                    '--placeholder-color': '#bbb',
                    '--color': '#333',
                    paddingTop: '16px',
                    paddingBottom: '16px'
                  }}
                />
              </IonItem>
            </IonCardContent>
          </IonCard>

          {/* 类别选择 */}
          <IonCard
            style={{
              margin: 0,
              borderRadius: '24px',
              background: 'rgba(255,255,255,0.95)',
              boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
              border: '1px solid rgba(148, 163, 184, 0.12)'
            }}
          >
            <IonCardContent style={{ padding: '14px 20px' }}>
              <div style={{
                marginBottom: '10px',
                fontWeight: '600',
                fontSize: '12px',
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <IonIcon icon={pricetagOutline} style={{ fontSize: '14px' }} />
                类别
              </div>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '8px', alignItems: 'center', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                  {categories.map((c, index) => (
                    <React.Fragment key={c.id}>
                      {index > 0 && <span style={{ color: '#ddd', fontSize: '14px', margin: '0 2px', flex: '0 0 auto' }}>•</span>}
                      <span
                        onClick={() => setSelectedCategoryId(c.id === selectedCategoryId ? '' : c.id)}
                        style={{
                          fontSize: '15px',
                          fontWeight: c.id === selectedCategoryId ? '600' : '400',
                          color: c.id === selectedCategoryId ? '#3b82f6' : '#666',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          userSelect: 'none',
                          flex: '0 0 auto'
                        }}
                      >
                        {c.name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </IonCardContent>
          </IonCard>

          {/* 目标选择 */}
          <IonCard
            style={{
              margin: 0,
              borderRadius: '24px',
              background: 'rgba(255,255,255,0.95)',
              boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
              border: '1px solid rgba(148, 163, 184, 0.12)'
            }}
          >
            <IonCardContent style={{ padding: '14px 20px' }}>
              <div style={{
                marginBottom: '10px',
                fontWeight: '600',
                fontSize: '12px',
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <IonIcon icon={flagOutline} style={{ fontSize: '14px' }} />
                关联目标
              </div>
              <div style={{ height: '56px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {entryDateGoals.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', paddingRight: '8px' }}>
                    {todayGoals.map((g, index) => (
                      <React.Fragment key={g.id}>
                        {index > 0 && <span style={{ color: '#ddd', fontSize: '14px', margin: '0 2px' }}>•</span>}
                        <span
                          onClick={() => setSelectedGoalId(g.id === selectedGoalId ? null : g.id!)}
                          style={{
                            fontSize: '15px',
                            fontWeight: g.id === selectedGoalId ? '600' : '400',
                            color: g.id === selectedGoalId ? '#f59e0b' : '#666',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            userSelect: 'none'
                          }}
                        >
                          {g.name}
                        </span>
                      </React.Fragment>
                    ))}
                    {todayGoals.length > 0 && yesterdayGoals.length > 0 &&
                      <span style={{ color: '#ddd', fontSize: '14px', margin: '0 2px' }}>•</span>
                    }
                    {yesterdayGoals.map((g, index) => (
                      <React.Fragment key={g.id}>
                        {index > 0 && <span style={{ color: '#ddd', fontSize: '14px', margin: '0 2px' }}>•</span>}
                        <span
                          onClick={() => setSelectedGoalId(g.id === selectedGoalId ? null : g.id!)}
                          style={{
                            fontSize: '15px',
                            fontWeight: g.id === selectedGoalId ? '600' : '400',
                            color: g.id === selectedGoalId ? '#f59e0b' : '#999',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            userSelect: 'none'
                          }}
                        >
                          {g.name}*
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#bbb', fontSize: '14px', height: '100%', display: 'flex', alignItems: 'center' }}>
                    该日期暂无目标
                  </div>
                )}
              </div>
            </IonCardContent>
          </IonCard>

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
