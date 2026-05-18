import React, { useState, useRef, useEffect } from 'react';
import { Drawer, Input, Button, Avatar, Typography, List, Space, Tag, Divider, Skeleton, Card, Table } from 'antd';
import { 
  SendOutlined, 
  RobotOutlined, 
  UserOutlined, 
  CloseOutlined, 
  MessageOutlined,
  WarningOutlined,
  ProjectOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useChatStore } from '../../store/chatStore';
import { chatbotService } from '../../services/chatbotService';
import StatusBadge from './StatusBadge';
import HoursProgress from './HoursProgress';

const { Title, Text, Paragraph } = Typography;

const AssistantDrawer = ({ open, onClose }) => {
  const { messages, isTyping, addMessage, setTyping } = useChatStore();
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (val = inputValue) => {
    if (!val.trim()) return;

    const userMsg = { role: 'user', type: 'text', content: val, timestamp: new Date() };
    addMessage(userMsg);
    setInputValue('');
    setTyping(true);

    try {
      const response = await chatbotService.sendQuery(val);
      addMessage({ role: 'bot', ...response, timestamp: new Date() });
    } catch (error) {
      addMessage({ role: 'bot', type: 'text', content: 'Sorry, I encountered an error.', timestamp: new Date() });
    } finally {
      setTyping(false);
    }
  };

  const renderResponseCard = (msg) => {
    switch (msg.type) {
      case 'report':
        return (
          <Card size="small" style={{ width: '100%', borderRadius: 12 }}>
            <Table 
              size="small" 
              pagination={false} 
              dataSource={msg.data}
              columns={[
                { title: 'Emp', dataIndex: 'employeeName', key: 'name' },
                { title: 'Project', dataIndex: 'projectName', key: 'project' },
                { title: 'Hrs', dataIndex: 'totalHours', key: 'hrs' }
              ]}
            />
          </Card>
        );
      case 'alerts':
        return (
          <Card size="small" style={{ width: '100%', borderRadius: 12 }}>
            <List
              size="small"
              dataSource={msg.data}
              renderItem={item => (
                <List.Item>
                  <Space>
                    <WarningOutlined style={{ color: item.severity === 'Critical' ? '#ff4d4f' : '#fa8c16' }} />
                    <Text fontSize={12}>{item.message}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        );
      case 'project':
        return (
          <Card size="small" style={{ width: '100%', borderRadius: 12 }}>
            <Title level={5}>{msg.title}</Title>
            <StatusBadge status={msg.data.status} />
            <HoursProgress consumed={msg.data.consumedHours} total={msg.data.approvedHours} />
          </Card>
        );
      default:
        return <Paragraph style={{ margin: 0 }}>{msg.content}</Paragraph>;
    }
  };

  return (
    <Drawer
      title={
        <Space>
          <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>Rabbit Assistant</div>
            <div style={{ fontSize: '10px', color: '#8c8c8c' }}>AI Project Partner</div>
          </div>
        </Space>
      }
      placement="right"
      width={400}
      onClose={onClose}
      open={open}
      closeIcon={<CloseOutlined />}
      footer={
        <div style={{ padding: '10px 0' }}>
          {messages.length < 3 && (
            <div style={{ marginBottom: 12 }}>
              <Space wrap>
                {["Today's reports", "Critical alerts", "Project status"].map(tag => (
                  <Tag 
                    key={tag} 
                    style={{ cursor: 'pointer', borderRadius: 12 }} 
                    onClick={() => handleSend(tag)}
                  >
                    {tag}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
          <Input.Search
            placeholder="Ask anything..."
            size="large"
            enterButton={<SendOutlined />}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onSearch={handleSend}
            loading={isTyping}
            disabled={isTyping}
          />
        </div>
      }
      bodyStyle={{ background: '#f0f2f5', display: 'flex', flexDirection: 'column', padding: '16px' }}
    >
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ 
            display: 'flex', 
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', 
            marginBottom: 16 
          }}>
            <div style={{ 
              maxWidth: '85%', 
              padding: msg.type === 'text' ? '10px 14px' : '4px',
              background: msg.role === 'user' ? '#1890ff' : '#fff',
              color: msg.role === 'user' ? '#fff' : 'inherit',
              borderRadius: msg.role === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
              {renderResponseCard(msg)}
              <div style={{ 
                fontSize: '9px', 
                color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#bfbfbf', 
                marginTop: 4, 
                textAlign: 'right' 
              }}>
                {dayjs(msg.timestamp).format('HH:mm')}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div style={{ display: 'flex', marginBottom: 16 }}>
            <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '16px 16px 16px 0' }}>
              <Skeleton.Button active size="small" shape="round" style={{ width: 40 }} />
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default AssistantDrawer;
