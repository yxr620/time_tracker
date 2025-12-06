import React, { useState, useEffect, useRef } from 'react';
import { DatePicker } from 'antd-mobile';
import { 
  IonModal, 
  IonContent, 
  IonButton, 
  IonInput, 
  useIonToast,
  useIonAlert,
  IonCard,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonText
} from '@ionic/react';
import { 
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline, 
  chevronForwardOutline, 
  calendarOutline
} from 'ionicons/icons';
import { useGoalStore } from '../../stores/goalStore';
import { useEntryStore } from '../../stores/entryStore';
import { useDateStore } from '../../stores/dateStore';
import dayjs from 'dayjs';
import type { Goal } from '../../services/db';

export const GoalManager: React.FC = () => {
  const currentDate = useDateStore(state => state.selectedDate);
  const setSelectedDate = useDateStore(state => state.setSelectedDate);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [present] = useIonToast();
  const [presentAlert] = useIonAlert();
  
  const addInputRef = useRef<HTMLIonInputElement>(null);
  const editInputRef = useRef<HTMLIonInputElement>(null);
  
  const { goals, loadGoals, addGoal, updateGoal, deleteGoal } = useGoalStore();
  const { entries, loadEntries } = useEntryStore();

  useEffect(() => {
    loadGoals();
    loadEntries(currentDate);
  }, [currentDate, loadEntries, loadGoals]);

  // 获取当天的目标
  const todayGoals = goals.filter(g => g.date === currentDate);

  // 计算某个目标的花费时长（分钟）
  const calculateGoalDuration = (goalId: string) => {
    const goalEntries = entries.filter(e => e.goalId === goalId && e.endTime);
    return goalEntries.reduce((total, entry) => {
      if (!entry.endTime) return total;
      const duration = dayjs(entry.endTime).diff(entry.startTime, 'minute');
      return total + duration;
    }, 0);
  };

  // 格式化时长显示
  const formatDuration = (minutes: number) => {
    if (minutes === 0) return '0分钟';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}分钟`;
    if (mins === 0) return `${hours}小时`;
    return `${hours}小时${mins}分钟`;
  };

  // 日期切换
  const handlePrevDay = () => {
    const prevDay = dayjs(currentDate).subtract(1, 'day').format('YYYY-MM-DD');
    setSelectedDate(prevDay);
  };

  const handleNextDay = () => {
    const nextDay = dayjs(currentDate).add(1, 'day').format('YYYY-MM-DD');
    setSelectedDate(nextDay);
  };

  const handleToday = () => {
    setSelectedDate(dayjs().format('YYYY-MM-DD'));
  };

  // 添加目标
  const handleAddGoal = async () => {
    if (!newGoalName.trim()) {
      present({
        message: '请输入目标名称',
        duration: 1500,
        position: 'top',
        color: 'danger'
      });
      return;
    }

    await addGoal({
      name: newGoalName.trim(),
      date: currentDate,
      color: '#1677ff'
    });
    
    setNewGoalName('');
    setShowAddGoal(false);
    present({
      message: '目标已添加',
      duration: 1500,
      position: 'top',
      color: 'success'
    });
  };

  // 删除目标
  const handleDeleteGoal = (goal: Goal) => {
    presentAlert({
      header: '确认删除',
      message: `确认删除目标"${goal.name}"吗？`,
      buttons: [
        {
          text: '取消',
          role: 'cancel',
        },
        {
          text: '确认',
          role: 'confirm',
          handler: async () => {
            await deleteGoal(goal.id!);
            present({
              message: '目标已删除',
              duration: 1500,
              position: 'top',
              color: 'success'
            });
          },
        },
      ],
    });
  };

  // 打开编辑弹窗
  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setEditGoalName(goal.name);
    setShowEditGoal(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editGoalName.trim()) {
      present({
        message: '请输入目标名称',
        duration: 1500,
        position: 'top',
        color: 'danger'
      });
      return;
    }

    if (!editingGoal?.id) return;

    await updateGoal(editingGoal.id, {
      name: editGoalName.trim()
    });
    
    setEditingGoal(null);
    setEditGoalName('');
    setShowEditGoal(false);
    present({
      message: '目标已更新',
      duration: 1500,
      position: 'top',
      color: 'success'
    });
  };

  // 获取日期显示文本
  const getDateDisplayText = () => {
    const today = dayjs().format('YYYY-MM-DD');
    if (currentDate === today) return '今天';
    
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    if (currentDate === yesterday) return '昨天';
    
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
    if (currentDate === tomorrow) return '明天';
    
    return dayjs(currentDate).format('MM月DD日');
  };

  // 计算总时长
  const totalDuration = todayGoals.reduce((total, goal) => {
    return total + calculateGoalDuration(goal.id!);
  }, 0);

  const isToday = currentDate === dayjs().format('YYYY-MM-DD');

  return (
    <div
      style={{
        padding: '16px',
        paddingBottom: '80px',
        minHeight: '100%'
      }}
    >
      {/* 日期选择器 */}
      <IonCard
        className="mb-4"
        style={{
          margin: 0,
          borderRadius: '24px',
          backdropFilter: 'blur(8px)',
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
          border: '1px solid rgba(148, 163, 184, 0.12)'
        }}
      >
        <IonCardContent className="pt-4 pb-4">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}
          >
            <IonButton
              fill="clear"
              color="medium"
              onClick={handlePrevDay}
              style={{
                '--padding-start': '6px',
                '--padding-end': '6px',
                '--padding-top': '6px',
                '--padding-bottom': '6px'
              }}
            >
              <IonIcon icon={chevronBackOutline} slot="icon-only" />
            </IonButton>

            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
              onClick={() => setShowDatePicker(true)}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#0f172a'
                }}
              >
                <IonIcon
                  icon={calendarOutline}
                  style={{ fontSize: '18px' }}
                />
                <span>{getDateDisplayText()}</span>
              </div>
            </div>

            <IonButton
              fill="clear"
              color="medium"
              onClick={handleNextDay}
              style={{
                '--padding-start': '6px',
                '--padding-end': '6px',
                '--padding-top': '6px',
                '--padding-bottom': '6px'
              }}
            >
              <IonIcon icon={chevronForwardOutline} slot="icon-only" />
            </IonButton>
          </div>

          {!isToday && (
            <IonButton
              expand="block"
              size="default"
              fill="outline"
              color="primary"
              onClick={handleToday}
              style={{
                marginTop: '16px',
                '--border-radius': '16px',
                '--padding-top': '10px',
                '--padding-bottom': '10px',
                fontWeight: 600
              }}
            >
              回到今天
            </IonButton>
          )}
        </IonCardContent>
      </IonCard>

      {/* 日期选择弹窗 */}
      <DatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        precision="day"
        value={new Date(currentDate)}
        onConfirm={(val) => {
          if (val) {
            setSelectedDate(dayjs(val).format('YYYY-MM-DD'));
          }
          setShowDatePicker(false);
        }}
      />

      {/* 统计信息 */}
      {todayGoals.length > 0 && (
        <IonCard
          className="mb-4"
          style={{
            margin: 0,
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.95)',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
            border: '1px solid rgba(148, 163, 184, 0.12)'
          }}
        >
          <IonCardContent className="pt-6 pb-6">
            <div
              style={{
                textAlign: 'center',
                fontSize: '34px',
                fontWeight: 700,
                color: '#0f172a'
              }}
            >
              {formatDuration(totalDuration)}
            </div>
          </IonCardContent>
        </IonCard>
      )}

      {/* 目标列表 */}
      <IonCard
        style={{
          margin: 0,
          borderRadius: '24px',
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
          border: '1px solid rgba(148, 163, 184, 0.12)'
        }}
      >
        <IonCardContent className="pb-0">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}
          >
            <IonText>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                目标列表 ({todayGoals.length})
              </h3>
            </IonText>
            <IonButton
              size="small"
              fill="clear"
              color="medium"
              onClick={() => setShowAddGoal(true)}
              style={{
                '--padding-start': '8px',
                '--padding-end': '8px',
                '--padding-top': '6px',
                '--padding-bottom': '6px',
                height: '32px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              <IonIcon icon={addOutline} slot="start" style={{ fontSize: '18px' }} />
              添加目标
            </IonButton>
          </div>

          {todayGoals.length === 0 ? (
            <div
              style={{
                padding: '48px 16px',
                textAlign: 'center',
                color: '#9ca3af'
              }}
            >
              暂无目标，点击上方按钮添加
            </div>
          ) : (
            <IonList
              style={{
                background: 'transparent',
                borderRadius: '16px',
                padding: 0
              }}
            >
              {todayGoals.map((goal, index) => {
                const duration = calculateGoalDuration(goal.id!);
                return (
                  <IonItem
                    key={goal.id}
                    lines={index === todayGoals.length - 1 ? 'none' : 'inset'}
                    style={{
                      '--padding-start': '16px',
                      '--padding-end': '12px',
                      '--inner-padding-end': '0px',
                      '--min-height': '68px',
                      '--border-color': 'rgba(226, 232, 240, 0.8)'
                    }}
                  >
                    <IonLabel>
                      <h2
                        style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          margin: '0 0 6px 0'
                        }}
                      >
                        {goal.name}
                      </h2>
                      <p
                        style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#1476ff',
                          margin: 0
                        }}
                      >
                        {formatDuration(duration)}
                      </p>
                    </IonLabel>
                    <div slot="end" style={{ display: 'flex', gap: '2px' }}>
                      <IonButton
                        fill="clear"
                        size="small"
                        color="medium"
                        onClick={() => handleEditGoal(goal)}
                        style={{
                          '--padding-start': '6px',
                          '--padding-end': '6px',
                          margin: 0,
                          height: '34px'
                        }}
                      >
                        <IonIcon icon={createOutline} style={{ fontSize: '18px' }} />
                      </IonButton>
                      <IonButton
                        fill="clear"
                        size="small"
                        color="danger"
                        onClick={() => handleDeleteGoal(goal)}
                        style={{
                          '--padding-start': '6px',
                          '--padding-end': '6px',
                          margin: 0,
                          height: '34px'
                        }}
                      >
                        <IonIcon icon={trashOutline} style={{ fontSize: '18px' }} />
                      </IonButton>
                    </div>
                  </IonItem>
                );
              })}
            </IonList>
          )}
        </IonCardContent>
      </IonCard>

      {/* 添加目标弹窗 (Ionic Sheet Modal) */}
      <IonModal 
        isOpen={showAddGoal} 
        onDidDismiss={() => setShowAddGoal(false)}
        // balanced height to keep button visible above keyboard
        initialBreakpoint={0.2}
        breakpoints={[0, 0.2]}
        style={{ '--border-radius': '24px' }}
        onDidPresent={() => {
          setTimeout(() => {
            addInputRef.current?.setFocus();
          }, 150);
        }}
      >
          <IonContent className="ion-padding" style={{ '--padding-top': '16px', '--padding-bottom': '2px' }}>
            <div className="flex flex-col gap-2">
            <div className="relative">
              <IonInput
                ref={addInputRef}
                value={newGoalName}
                placeholder="输入目标名称"
                onIonInput={e => setNewGoalName(e.detail.value!)}
                clearInput
                className="text-lg"
                style={{ 
                  '--background': '#f8fafc',
                  '--border-radius': '16px',
                  '--padding-start': '20px', 
                  '--padding-end': '20px', 
                  '--padding-top': '16px', 
                  '--padding-bottom': '16px',
                  '--placeholder-color': '#94a3b8',
                  '--highlight-height': '0px',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddGoal();
                  }
                }}
              ></IonInput>
            </div>
            
            <IonButton 
              expand="block" 
              onClick={handleAddGoal} 
              style={{ 
                '--border-radius': '16px',
                '--box-shadow': 'none',
                '--padding-top': '12px',
                '--padding-bottom': '12px',
                fontSize: '17px',
                fontWeight: '600'
              }}
            >
              确认添加
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      {/* 编辑目标弹窗 (Ionic Sheet Modal) */}
      <IonModal 
        isOpen={showEditGoal} 
        onDidDismiss={() => {
          setShowEditGoal(false);
          setEditingGoal(null);
          setEditGoalName('');
        }}
        // balanced height to keep button visible above keyboard
        initialBreakpoint={0.2}
        breakpoints={[0, 0.2]}
        style={{ '--border-radius': '24px' }}
        onDidPresent={() => {
          setTimeout(() => {
            editInputRef.current?.setFocus();
          }, 150);
        }}
      >
          <IonContent className="ion-padding" style={{ '--padding-top': '16px', '--padding-bottom': '2px' }}>
            <div className="flex flex-col gap-2">
            <div className="relative">
              <IonInput
                ref={editInputRef}
                value={editGoalName}
                placeholder="输入目标名称"
                onIonInput={e => setEditGoalName(e.detail.value!)}
                clearInput
                className="text-lg"
                style={{ 
                  '--background': '#f8fafc',
                  '--border-radius': '16px',
                  '--padding-start': '20px', 
                  '--padding-end': '20px', 
                  '--padding-top': '16px', 
                  '--padding-bottom': '16px',
                  '--placeholder-color': '#94a3b8',
                  '--highlight-height': '0px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveEdit();
                  }
                }}
              ></IonInput>
            </div>
            
            <IonButton 
              expand="block" 
              onClick={handleSaveEdit} 
              style={{ 
                '--border-radius': '16px',
                '--box-shadow': 'none',
                '--padding-top': '12px',
                '--padding-bottom': '12px',
                fontSize: '17px',
                fontWeight: '600'
              }}
            >
              保存修改
            </IonButton>
          </div>
        </IonContent>
      </IonModal>
    </div>
  );
};
