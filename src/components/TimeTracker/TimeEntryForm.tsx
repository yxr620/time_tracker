import React, { useState, useEffect } from 'react';
import { DatePicker, Space, Selector } from 'antd-mobile';
import { 
  IonButton, 
  IonInput, 
  IonItem, 
  IonIcon, 
  useIonToast,
  IonCard,
  IonCardContent 
} from '@ionic/react';
import { playOutline, stopOutline, saveOutline } from 'ionicons/icons';
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
      <div style={{ padding: '20px 16px' }}>
        <Space direction="vertical" style={{ width: '100%', '--gap': '16px' }} block>
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
        </Space>
      </div>
    );
  }

  // 正常的录入界面
  return (
    <div style={{ padding: '12px 12px' }}>
      <Space direction="vertical" style={{ width: '100%', '--gap': '12px' }} block>
        {/* 活动名称输入 - Ionic风格 */}
        <IonCard style={{ margin: 0, borderRadius: '16px', boxShadow: 'none', border: '1px solid #f0f0f0', background: '#fff' }}>
          <IonCardContent style={{ padding: '0' }}>
            <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '16px' }}>
              <IonInput
                placeholder="准备做什么？"
                value={activity}
                onIonInput={e => setActivity(e.detail.value!)}
                clearInput
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  '--placeholder-color': '#ccc',
                  '--color': '#333',
                  paddingTop: '12px',
                  paddingBottom: '12px'
                }}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>
        
        {/* 类别选择 - 胶囊风格 */}
        <div>
          <div style={{ marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#333' }}>类别</div>
          <Selector
            options={categories.map(c => ({
              label: c.name,
              value: c.id
            }))}
            value={[selectedCategoryId]}
            onChange={(arr) => setSelectedCategoryId(arr[0] || '')}
            style={{
              '--border-radius': '100px',
              '--border': 'none',
              '--checked-border': 'none',
              '--checked-color': '#e6f7ff',
              '--checked-text-color': '#1677ff',
              '--padding': '4px 10px',
              '--font-size': '12px',
              '--color': '#f7f8fa',
              '--text-color': '#666',
              '--gap': '6px'
            } as React.CSSProperties}
          />
        </div>
        
        {/* 目标选择 - 胶囊风格 */}
        <div>
          <div style={{ marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#333' }}>关联目标</div>
          {availableGoals.length > 0 ? (
            <Selector
              options={[
                ...currentGoals.map(g => ({
                  label: `${g.name}`,
                  value: g.id!
                })),
                ...filteredPrevGoals.map(g => ({
                  label: `${g.name}*`,
                  value: g.id!
                }))
              ]}
              value={[selectedGoalId || '']}
              onChange={(arr) => setSelectedGoalId(arr[0] || null)}
              style={{
                '--border-radius': '100px',
                '--border': 'none',
                '--checked-border': 'none',
                '--checked-color': '#fff7e6', // 橙色系背景
                '--checked-text-color': '#fa8c16', // 橙色系文字
                '--padding': '4px 10px',
                '--font-size': '12px',
                '--color': '#f7f8fa',
                '--text-color': '#666',
                '--gap': '6px'
              } as React.CSSProperties}
            />
          ) : (
            <div style={{ color: '#999', fontSize: '12px', padding: '2px 0' }}>
              该日期暂无目标
            </div>
          )}
        </div>

        {/* 时间选择卡片 */}
        <div style={{ 
          background: '#f9f9f9', 
          borderRadius: '16px', 
          padding: '12px 16px',
          marginTop: '4px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* 开始时间 */}
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setStartPickerVisible(true)}>
               <div style={{ color: '#999', fontSize: '12px', marginBottom: '2px' }}>开始时间</div>
               <div style={{ fontSize: '22px', fontWeight: '600', color: '#333', lineHeight: 1.2, fontFamily: 'Monaco, monospace' }}>
                 {dayjs(startTime).format('HH:mm')}
               </div>
               <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                 {dayjs(startTime).format('MM月DD日')}
               </div>
               <div style={{ marginTop: '8px' }}>
                 <span
                   onClick={(e) => { e.stopPropagation(); setToNow(true); }}
                   style={{ 
                     fontSize: '11px', 
                     color: '#666', 
                     background: '#fff', 
                     padding: '2px 8px', 
                     borderRadius: '10px', 
                     boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                     display: 'inline-block'
                   }}
                 >
                   设为现在
                 </span>
               </div>
            </div>

            {/* 分割线 */}
            <div style={{ width: '1px', height: '50px', background: '#e0e0e0', margin: '0 16px', alignSelf: 'center' }}></div>

            {/* 结束时间 */}
            <div style={{ flex: 1, textAlign: 'right', cursor: 'pointer' }} onClick={() => setEndPickerVisible(true)}>
               <div style={{ color: '#999', fontSize: '12px', marginBottom: '2px' }}>结束时间</div>
               <div style={{ 
                 fontSize: '22px', 
                 fontWeight: '600', 
                 color: endTime ? '#333' : '#00b578', 
                 lineHeight: 1.2,
                 fontFamily: endTime ? 'Monaco, monospace' : 'inherit'
               }}>
                 {endTime ? dayjs(endTime).format('HH:mm') : '进行中'}
               </div>
               <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                 {endTime ? dayjs(endTime).format('MM月DD日') : '点击停止'}
               </div>
               <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                 <span
                   onClick={(e) => { e.stopPropagation(); setToNow(false); }}
                   style={{ 
                     fontSize: '11px', 
                     color: '#666', 
                     background: '#fff', 
                     padding: '2px 8px', 
                     borderRadius: '10px', 
                     boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                     display: 'inline-block'
                   }}
                 >
                   现在
                 </span>
                 <span
                   onClick={(e) => { e.stopPropagation(); setEndTimeToOngoing(); }}
                   style={{ 
                     fontSize: '11px', 
                     color: '#00b578', 
                     background: '#e6f7ff', 
                     padding: '2px 8px', 
                     borderRadius: '10px',
                     display: 'inline-block'
                   }}
                 >
                   进行中
                 </span>
               </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ marginTop: '8px' }}>
          {endTime === null ? (
            <IonButton
              expand="block"
              color="primary"
              shape="round"
              onClick={handleStartTracking}
              disabled={!activity.trim()}
              style={{
                height: '48px',
                fontSize: '16px',
                fontWeight: '600',
                '--box-shadow': '0 6px 16px rgba(22, 119, 255, 0.25)'
              }}
            >
              <IonIcon slot="start" icon={playOutline} />
              开始计时
            </IonButton>
          ) : (
            <IonButton
              expand="block"
              color="primary"
              shape="round"
              onClick={handleSaveManualEntry}
              disabled={!activity.trim()}
              style={{
                height: '48px',
                fontSize: '16px',
                fontWeight: '600',
                '--box-shadow': '0 6px 16px rgba(22, 119, 255, 0.25)'
              }}
            >
              <IonIcon slot="start" icon={saveOutline} />
              保存记录
            </IonButton>
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
