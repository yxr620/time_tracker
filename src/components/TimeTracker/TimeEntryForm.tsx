import React, { useState, useEffect } from 'react';
import { DatePicker } from 'antd-mobile';
import {
  IonButton,
  IonInput,
  IonItem,
  IonIcon,
  useIonToast,
  IonCard,
  IonCardContent
} from '@ionic/react';
import { playOutline, stopOutline, saveOutline, chatbubbleOutline, pricetagOutline, flagOutline, refreshOutline } from 'ionicons/icons';
import { useEntryStore } from '../../stores/entryStore';
import { useGoalStore } from '../../stores/goalStore';
import { useCategoryStore } from '../../stores/categoryStore';
import dayjs from 'dayjs';

export const TimeEntryForm: React.FC = () => {
  const { currentEntry, startTracking, stopTracking, addEntry, nextStartTime, nextEndTime, setTimeRange, getLastEntryEndTime, loadEntries } = useEntryStore();
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
  const [present] = useIonToast();

  // 初始化：加载数据
  useEffect(() => {
    const init = async () => {
      await Promise.all([loadGoals(), loadCategories(), loadEntries()]);
      // 数据加载完成后，设置初始开始时间
      const lastEndTime = getLastEntryEndTime();
      if (lastEndTime) {
        // 确保是 Date 对象
        setStartTime(lastEndTime instanceof Date ? lastEndTime : new Date(lastEndTime));
      }
    };
    init();
  }, []);

  // 当从记录列表或时间轴点击时，自动设置开始时间和结束时间
  useEffect(() => {
    if (nextStartTime) {
      // 确保是 Date 对象
      setStartTime(nextStartTime instanceof Date ? nextStartTime : new Date(nextStartTime));
      if (nextEndTime) {
        setEndTime(nextEndTime instanceof Date ? nextEndTime : new Date(nextEndTime));
      } else {
        // 如果只设置了开始时间（点击已存在的记录），清空结束时间
        setEndTime(null);
      }
      // 重置store中的时间
      setTimeRange(null as any, null as any);
    }
  }, [nextStartTime, nextEndTime, setTimeRange]);

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

  // 获取当前选中日期和前一天的目标（基于开始时间）
  const currentDateStr = dayjs(startTime).format('YYYY-MM-DD');
  const prevDateStr = dayjs(startTime).subtract(1, 'day').format('YYYY-MM-DD');

  const currentGoals = goals.filter(g => g.date === currentDateStr);
  const prevGoals = goals.filter(g => g.date === prevDateStr);

  // 过滤掉与当前日期目标重复的前一天目标
  const currentGoalNamesLower = currentGoals.map(g => g.name.toLowerCase().trim());
  const filteredPrevGoals = prevGoals.filter(
    g => !currentGoalNamesLower.includes(g.name.toLowerCase().trim())
  );

  const availableGoals = [...currentGoals, ...filteredPrevGoals];

  // 设置结束时间为"正在进行"
  const setEndTimeToOngoing = () => {
    setEndTime(null);
    present({
      message: '已设置为正在进行',
      duration: 1500,
      position: 'top',
      color: 'success'
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
      present({
        message: '请输入活动名称',
        duration: 1500,
        position: 'top',
        color: 'danger'
      });
      return;
    }

    await startTracking(
      activity,
      selectedGoalId || undefined,
      startTime,
      selectedCategoryId || undefined
    );

    present({
      message: '开始计时',
      duration: 1500,
      position: 'top',
      color: 'success'
    });

    // 清空表单
    setActivity('');
    setSelectedCategoryId('');
    setSelectedGoalId(null);
    const lastEndTime = getLastEntryEndTime();
    setStartTime(lastEndTime ? (lastEndTime instanceof Date ? lastEndTime : new Date(lastEndTime)) : new Date());
    setEndTime(null);
  };

  // 停止当前计时
  const handleStopTracking = async () => {
    await stopTracking();
    present({
      message: '已停止计时',
      duration: 1500,
      position: 'top',
      color: 'success'
    });
    // 重置开始时间为最后记录的结束时间
    const lastEndTime = getLastEntryEndTime();
    setStartTime(lastEndTime ? (lastEndTime instanceof Date ? lastEndTime : new Date(lastEndTime)) : new Date());
  };

  // 保存手动添加的记录
  const handleSaveManualEntry = async () => {
    if (!activity.trim()) {
      present({
        message: '请输入活动名称',
        duration: 1500,
        position: 'top',
        color: 'danger'
      });
      return;
    }

    if (!endTime) {
      present({
        message: '请设置结束时间或使用"开始计时"',
        duration: 1500,
        position: 'top',
        color: 'warning'
      });
      return;
    }

    if (endTime <= startTime) {
      present({
        message: '结束时间必须晚于开始时间',
        duration: 1500,
        position: 'top',
        color: 'danger'
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

    present({
      message: '记录已保存',
      duration: 1500,
      position: 'top',
      color: 'success'
    });

    // 清空表单
    setActivity('');
    setSelectedCategoryId('');
    setSelectedGoalId(null);
    const lastEndTime = getLastEntryEndTime();
    setStartTime(lastEndTime ? (lastEndTime instanceof Date ? lastEndTime : new Date(lastEndTime)) : new Date());
    setEndTime(null);
  };

  // 如果正在计时，显示计时器界面
  if (currentEntry) {
    return (
      <div style={{ padding: '20px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0, 181, 120, 0.1)',
              padding: '4px 10px',
              borderRadius: '16px'
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#00b578',
                boxShadow: '0 0 8px rgba(0, 181, 120, 0.5)'
              }}></div>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#00b578' }}>正在计时</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333', marginTop: '12px' }}>
              {currentEntry.activity}
            </div>
          </div>

          <div style={{
            fontSize: '48px',
            fontWeight: '700',
            textAlign: 'center',
            fontFamily: 'Monaco, Menlo, Consolas, "Courier New", monospace',
            color: '#333',
            letterSpacing: '-1px',
            margin: '10px 0'
          }}>
            {elapsed}
          </div>

          <IonButton
            expand="block"
            color="danger"
            shape="round"
            style={{
              height: '48px',
              fontSize: '18px',
              fontWeight: '600',
              '--box-shadow': '0 6px 16px rgba(255, 77, 79, 0.25)',
              marginTop: '10px'
            }}
            onClick={handleStopTracking}
          >
            <IonIcon slot="start" icon={stopOutline} />
            停止计时
          </IonButton>
        </div>
      </div>
    );
  }

  // 正常的录入界面
  return (
    <div style={{ padding: '16px', background: '#ffffff', minHeight: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* 活动名称输入 */}
        <IonCard style={{
          margin: 0,
          borderRadius: '20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          border: '1px solid #f0f0f0',
          background: '#ffffff'
        }}>
          <IonCardContent style={{ padding: 0 }}>
            <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '20px', '--padding-end': '20px' }}>
              <IonIcon icon={chatbubbleOutline} slot="start" style={{ color: '#bbb', fontSize: '20px', marginRight: '8px' }} />
              <IonInput
                placeholder="准备做什么？"
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
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '14px 18px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {categories.map((c, index) => (
              <React.Fragment key={c.id}>
                {index > 0 && <span style={{ color: '#ddd', fontSize: '14px', margin: '0 2px' }}>•</span>}
                <span
                  onClick={() => setSelectedCategoryId(c.id === selectedCategoryId ? '' : c.id)}
                  style={{
                    fontSize: '15px',
                    fontWeight: c.id === selectedCategoryId ? '600' : '400',
                    color: c.id === selectedCategoryId ? '#3b82f6' : '#666',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    userSelect: 'none'
                  }}
                >
                  {c.name}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* 目标选择 */}
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '14px 18px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}>
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
          {availableGoals.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {currentGoals.map((g, index) => (
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
              {currentGoals.length > 0 && filteredPrevGoals.length > 0 &&
                <span style={{ color: '#ddd', fontSize: '14px', margin: '0 2px' }}>•</span>
              }
              {filteredPrevGoals.map((g, index) => (
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
            <div style={{ color: '#bbb', fontSize: '14px' }}>
              该日期暂无目标
            </div>
          )}
        </div>

        {/* 时间选择卡片 */}
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '16px 18px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
            {/* 开始时间 */}
            <div style={{ flex: '0 0 auto', cursor: 'pointer', minWidth: '80px' }} onClick={() => setStartPickerVisible(true)}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#333', lineHeight: 1.2, fontFamily: 'Monaco, Menlo, monospace', marginBottom: '10px' }}>
                {dayjs(startTime).format('HH:mm')}
              </div>
              <div>
                <span
                  onClick={(e) => { e.stopPropagation(); setToNow(true); }}
                  style={{
                    fontSize: '11px',
                    color: '#666',
                    background: '#f7f8fa',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <IonIcon icon={refreshOutline} style={{ fontSize: '12px' }} />
                  现在
                </span>
              </div>
            </div>

            {/* 时间轴箭头 */}
            <div style={{ color: '#e0e0e0', fontSize: '20px', flexShrink: 0 }}>→</div>

            {/* 结束时间 */}
            <div style={{ flex: 1, textAlign: 'right', cursor: 'pointer', minWidth: 0 }} onClick={() => setEndPickerVisible(true)}>
              <div style={{
                fontSize: '28px',
                fontWeight: '700',
                color: endTime ? '#333' : '#10b981',
                lineHeight: 1.2,
                fontFamily: endTime ? 'Monaco, Menlo, monospace' : 'inherit',
                marginBottom: '10px'
              }}>
                {endTime ? dayjs(endTime).format('HH:mm') : '进行中'}
                {!endTime && <span style={{ fontSize: '16px', marginLeft: '4px' }}>●</span>}
              </div>
              <div>
                <span
                  onClick={(e) => { e.stopPropagation(); setEndTimeToOngoing(); }}
                  style={{
                    fontSize: '11px',
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  进行中
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ marginTop: '4px' }}>
          {endTime === null ? (
            <IonButton
              expand="block"
              color="primary"
              onClick={handleStartTracking}
              disabled={!activity.trim()}
              style={{
                height: '52px',
                fontSize: '17px',
                fontWeight: '600',
                '--border-radius': '26px',
                '--background': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                '--box-shadow': '0 4px 12px rgba(59, 130, 246, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              开始计时
              <IonIcon slot="end" icon={playOutline} style={{ fontSize: '20px' }} />
            </IonButton>
          ) : (
            <IonButton
              expand="block"
              color="primary"
              onClick={handleSaveManualEntry}
              disabled={!activity.trim()}
              style={{
                height: '52px',
                fontSize: '17px',
                fontWeight: '600',
                '--border-radius': '26px',
                '--background': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                '--box-shadow': '0 4px 12px rgba(59, 130, 246, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              保存记录
              <IonIcon slot="end" icon={saveOutline} style={{ fontSize: '20px' }} />
            </IonButton>
          )}
        </div>
      </div>

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
