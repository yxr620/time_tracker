import React, { useState, useEffect } from 'react';
import {
  IonCard,
  IonCardContent,
  IonItem,
  IonIcon,
  IonInput,
  IonModal,
  IonButton,
  IonDatetime,
  useIonToast
} from '@ionic/react';
import { chatbubbleOutline, pricetagOutline, flagOutline } from 'ionicons/icons';
import { useGoalStore } from '../../stores/goalStore';
import { useCategoryStore } from '../../stores/categoryStore';
import { useEntryStore } from '../../stores/entryStore';
import type { TimeEntry } from '../../services/db';
import dayjs from 'dayjs';
import './EditEntryDialog.css';

// ============ 工具函数 ============

const toIonDatetimeValue = (date: Date): string =>
  dayjs(date).format('YYYY-MM-DDTHH:mm');

const fromIonDatetimeValue = (value: string): Date =>
  dayjs(value).toDate();

// ============ 样式常量 ============

// CARD_STYLE moved to EditEntryDialog.css via .edit-dialog-card class

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
  const [startDraftValue, setStartDraftValue] = useState(() => toIonDatetimeValue(new Date()));
  const [endDraftValue, setEndDraftValue] = useState(() => toIonDatetimeValue(new Date()));
  const [present] = useIonToast();

  useEffect(() => {
    if (visible) {
      loadGoals();
      loadCategories();
    }
  }, [visible, loadGoals, loadCategories]);

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

  // 同步时间选择器草稿值
  useEffect(() => {
    if (startPickerVisible) {
      setStartDraftValue(toIonDatetimeValue(startTime));
    }
  }, [startPickerVisible, startTime]);

  useEffect(() => {
    if (endPickerVisible) {
      setEndDraftValue(toIonDatetimeValue(endTime ?? new Date()));
    }
  }, [endPickerVisible, endTime]);

  // Toast helper
  const showToast = (message: string, color: 'success' | 'danger' | 'warning') => {
    present({ message, duration: 1500, position: 'top', color });
  };

  const handleSubmit = async () => {
    if (!entry?.id || !activity.trim()) {
      return;
    }

    if (endTime && endTime <= startTime) {
      showToast('结束时间必须晚于开始时间', 'danger');
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
      showToast('已设置为上次结束时间', 'success');
    } else {
      showToast('没有找到上次记录', 'danger');
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
    showToast('已设置为正在进行', 'success');
  };

  if (!entry) return null;

  return (
    <>
      <IonModal
        isOpen={visible}
        onDidDismiss={onClose}
        initialBreakpoint={0.9}
        breakpoints={[0, 0.9]}
      >
        <div className="edit-dialog-content">
          <h3 className="edit-dialog-title">编辑记录</h3>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 活动名称输入 */}
            <IonCard className="edit-dialog-card">
              <IonCardContent style={{ padding: 0 }}>
                <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '20px', '--padding-end': '20px' }}>
                  <IonIcon icon={chatbubbleOutline} slot="start" style={{ color: '#bbb', fontSize: '20px', marginRight: '8px' }} />
                  <IonInput
                    placeholder="输入活动名称"
                    value={activity}
                    onIonInput={e => setActivity(e.detail.value!)}
                    clearInput
                    className="edit-dialog-input"
                  />
                </IonItem>
              </IonCardContent>
            </IonCard>

            {/* 类别选择 */}
            <IonCard className="edit-dialog-card">
              <IonCardContent style={{ padding: '14px 20px' }}>
                <div className="edit-dialog-section-label">
                  <IonIcon icon={pricetagOutline} style={{ fontSize: '14px' }} />
                  类别
                </div>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '8px', alignItems: 'center', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                    {categories.map((c, index) => (
                      <React.Fragment key={c.id}>
                        {index > 0 && <span className="edit-dialog-dot">•</span>}
                        <span
                          onClick={() => setSelectedCategoryId(c.id === selectedCategoryId ? '' : c.id)}
                          className={`edit-dialog-option ${c.id === selectedCategoryId ? 'selected' : ''}`}
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
            <IonCard className="edit-dialog-card">
              <IonCardContent style={{ padding: '14px 20px' }}>
                <div className="edit-dialog-section-label">
                  <IonIcon icon={flagOutline} style={{ fontSize: '14px' }} />
                  关联目标
                </div>
                <div style={{ height: '56px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  {entryDateGoals.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', paddingRight: '8px' }}>
                      {todayGoals.map((g, index) => (
                        <React.Fragment key={g.id}>
                          {index > 0 && <span className="edit-dialog-dot">•</span>}
                          <span
                            onClick={() => setSelectedGoalId(g.id === selectedGoalId ? null : g.id!)}
                            className={`edit-dialog-option goal ${g.id === selectedGoalId ? 'selected' : ''}`}
                          >
                            {g.name}
                          </span>
                        </React.Fragment>
                      ))}
                      {todayGoals.length > 0 && yesterdayGoals.length > 0 &&
                        <span className="edit-dialog-dot">•</span>
                      }
                      {yesterdayGoals.map((g, index) => (
                        <React.Fragment key={g.id}>
                          {index > 0 && <span className="edit-dialog-dot">•</span>}
                          <span
                            onClick={() => setSelectedGoalId(g.id === selectedGoalId ? null : g.id!)}
                            className={`edit-dialog-option goal yesterday ${g.id === selectedGoalId ? 'selected' : ''}`}
                          >
                            {g.name}*
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div className="edit-dialog-empty-hint">
                      该日期暂无目标
                    </div>
                  )}
                </div>
              </IonCardContent>
            </IonCard>

            {/* 时间选择 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>开始时间</div>
                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={() => setStartPickerVisible(true)}
                >
                  {dayjs(startTime).format('YYYY-MM-DD HH:mm')}
                </IonButton>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <IonButton
                    size="small"
                    fill="outline"
                    onClick={() => setToNow(true)}
                  >
                    现在
                  </IonButton>
                  <IonButton
                    size="small"
                    fill="outline"
                    color="primary"
                    onClick={setStartTimeToLastEnd}
                  >
                    上次结束
                  </IonButton>
                </div>
              </div>

              <div>
                <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>结束时间</div>
                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={() => setEndPickerVisible(true)}
                >
                  {endTime ? dayjs(endTime).format('YYYY-MM-DD HH:mm') : '正在进行'}
                </IonButton>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <IonButton
                    size="small"
                    fill="outline"
                    onClick={() => setToNow(false)}
                  >
                    现在
                  </IonButton>
                  <IonButton
                    size="small"
                    fill="outline"
                    color="warning"
                    onClick={setEndTimeToOngoing}
                  >
                    正在进行
                  </IonButton>
                </div>
              </div>
            </div>
          </div>

          <div className="edit-dialog-footer">
            <div style={{ display: 'flex', gap: '12px' }}>
              <IonButton
                expand="block"
                fill="outline"
                onClick={onClose}
                style={{ flex: 1 }}
              >
                取消
              </IonButton>
              <IonButton
                expand="block"
                onClick={handleSubmit}
                disabled={!activity.trim()}
                style={{ flex: 1 }}
              >
                保存
              </IonButton>
            </div>
          </div>
        </div>
      </IonModal>

      {/* 开始时间选择器 Modal */}
      <IonModal
        isOpen={startPickerVisible}
        onDidDismiss={() => setStartPickerVisible(false)}
        initialBreakpoint={0.4}
        breakpoints={[0, 0.4]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '100px', paddingBottom: '16px' }}>
            <IonButton fill="clear" onClick={() => setStartPickerVisible(false)}>
              取消
            </IonButton>
            <IonButton
              fill="clear"
              onClick={() => {
                const nextDate = fromIonDatetimeValue(startDraftValue);
                setStartTime(nextDate);
                setStartPickerVisible(false);
              }}
            >
              确定
            </IonButton>
          </div>
          <IonDatetime
            value={startDraftValue}
            presentation="date-time"
            preferWheel
            locale="zh-CN"
            onIonChange={e => {
              const next = e.detail.value;
              if (typeof next === 'string') {
                setStartDraftValue(next);
              }
            }}
            style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}
          />
        </div>
      </IonModal>

      {/* 结束时间选择器 Modal */}
      <IonModal
        isOpen={endPickerVisible}
        onDidDismiss={() => setEndPickerVisible(false)}
        initialBreakpoint={0.4}
        breakpoints={[0, 0.4]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '100px', paddingBottom: '16px' }}>
            <IonButton fill="clear" onClick={() => setEndPickerVisible(false)}>
              取消
            </IonButton>
            <IonButton
              fill="clear"
              onClick={() => {
                const nextDate = fromIonDatetimeValue(endDraftValue);
                setEndTime(nextDate);
                setEndPickerVisible(false);
              }}
            >
              确定
            </IonButton>
          </div>
          <IonDatetime
            value={endDraftValue}
            presentation="date-time"
            preferWheel
            locale="zh-CN"
            onIonChange={e => {
              const next = e.detail.value;
              if (typeof next === 'string') {
                setEndDraftValue(next);
              }
            }}
            style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}
          />
        </div>
      </IonModal>
    </>
  );
};
