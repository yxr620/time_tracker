import React, { useState, useEffect } from 'react';
import { Button, List, Dialog, Input, Space, Card, DatePicker, Popup, Toast } from 'antd-mobile';
import { AddOutline, DeleteOutline, LeftOutline, RightOutline } from 'antd-mobile-icons';
import { useGoalStore } from '../../stores/goalStore';
import { useEntryStore } from '../../stores/entryStore';
import dayjs from 'dayjs';
import type { Goal } from '../../services/db';

export const GoalManager: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const { goals, loadGoals, addGoal, deleteGoal } = useGoalStore();
  const { entries, loadEntries } = useEntryStore();

  useEffect(() => {
    loadGoals();
    loadEntries(currentDate);
  }, [currentDate]);

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
    setCurrentDate(prevDay);
  };

  const handleNextDay = () => {
    const nextDay = dayjs(currentDate).add(1, 'day').format('YYYY-MM-DD');
    setCurrentDate(nextDay);
  };

  const handleToday = () => {
    setCurrentDate(dayjs().format('YYYY-MM-DD'));
  };

  // 添加目标
  const handleAddGoal = async () => {
    if (!newGoalName.trim()) {
      Toast.show({
        icon: 'fail',
        content: '请输入目标名称'
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
    Toast.show({
      icon: 'success',
      content: '目标已添加'
    });
  };

  // 删除目标
  const handleDeleteGoal = (goal: Goal) => {
    Dialog.confirm({
      content: `确认删除目标"${goal.name}"吗？`,
      onConfirm: async () => {
        await deleteGoal(goal.id!);
        Toast.show({
          icon: 'success',
          content: '目标已删除'
        });
      }
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

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      {/* 日期选择器 */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button 
            fill="none" 
            onClick={handlePrevDay}
            style={{ fontSize: '20px' }}
          >
            <LeftOutline />
          </Button>
          
          <div 
            style={{ 
              flex: 1, 
              textAlign: 'center',
              cursor: 'pointer'
            }}
            onClick={() => setShowDatePicker(true)}
          >
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {getDateDisplayText()}
            </div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              {dayjs(currentDate).format('YYYY-MM-DD')}
            </div>
          </div>
          
          <Button 
            fill="none" 
            onClick={handleNextDay}
            style={{ fontSize: '20px' }}
          >
            <RightOutline />
          </Button>
        </div>
        
        {currentDate !== dayjs().format('YYYY-MM-DD') && (
          <Button 
            block 
            size="small" 
            fill="outline"
            onClick={handleToday}
            style={{ marginTop: '12px' }}
          >
            回到今天
          </Button>
        )}
      </Card>

      {/* 日期选择弹窗 */}
      <Popup
        visible={showDatePicker}
        onMaskClick={() => setShowDatePicker(false)}
        bodyStyle={{ height: '40vh' }}
      >
        <DatePicker
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          precision="day"
          value={new Date(currentDate)}
          onConfirm={(val) => {
            setCurrentDate(dayjs(val).format('YYYY-MM-DD'));
            setShowDatePicker(false);
          }}
        />
      </Popup>

      {/* 统计信息 */}
      {todayGoals.length > 0 && (
        <Card style={{ marginBottom: '16px', backgroundColor: '#f5f5f5' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#666' }}>今日总计</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px', color: '#1677ff' }}>
              {formatDuration(totalDuration)}
            </div>
          </div>
        </Card>
      )}

      {/* 目标列表 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
            目标列表 ({todayGoals.length})
          </div>
          <Button 
            size="small" 
            color="primary"
            onClick={() => setShowAddGoal(true)}
          >
            <AddOutline /> 添加目标
          </Button>
        </div>

        {todayGoals.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              暂无目标，点击上方按钮添加
            </div>
          </Card>
        ) : (
          <List>
            {todayGoals.map(goal => {
              const duration = calculateGoalDuration(goal.id!);
              return (
                <List.Item
                  key={goal.id}
                  extra={
                    <Button
                      size="small"
                      fill="none"
                      color="danger"
                      onClick={() => handleDeleteGoal(goal)}
                    >
                      <DeleteOutline />
                    </Button>
                  }
                  description={
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1677ff' }}>
                        {formatDuration(duration)}
                      </span>
                    </div>
                  }
                >
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    {goal.name}
                  </div>
                </List.Item>
              );
            })}
          </List>
        )}
      </div>

      {/* 添加目标弹窗 */}
      <Popup
        visible={showAddGoal}
        onMaskClick={() => {
          setShowAddGoal(false);
          setNewGoalName('');
        }}
        bodyStyle={{ height: '35vh' }} // 调整 添加新目标 和输入法之间的间距
      >
        <div style={{ padding: '16px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
            添加新目标
          </div>
          <Space direction="vertical" style={{ width: '100%' }} block>
            <Input
              placeholder="请输入目标名称"
              value={newGoalName}
              onChange={setNewGoalName}
              clearable
              autoFocus // 自动聚焦输入框，弹出输入法。
            />
            <div style={{ fontSize: '14px', color: '#999' }}>
              日期：{dayjs(currentDate).format('YYYY年MM月DD日')}
            </div>
            <Button
              block
              color="primary"
              size="large"
              onClick={handleAddGoal}
            >
              确认添加
            </Button>
            <Button
              block
              fill="outline"
              size="large"
              onClick={() => {
                setShowAddGoal(false);
                setNewGoalName('');
              }}
            >
              取消
            </Button>
          </Space>
        </div>
      </Popup>
    </div>
  );
};
