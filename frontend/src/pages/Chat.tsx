import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { ChatWindow } from '../components/chat/ChatWindow';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ErrorMessage } from '../components/shared/ErrorMessage';

export function Chat() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const prevId = useRef<string | undefined>(undefined);

  const {
    messages,
    isLoading,
    error,
    mode,
    setMode,
    precision,
    setPrecision,
    send,
    upload,
    history,
    loadHistory,
    loadConversation,
    removeConversation,
    clearMessages,
  } = useChat();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (id && id !== prevId.current) {
      prevId.current = id;
      loadConversation(id);
    } else if (!id && prevId.current !== undefined) {
      prevId.current = undefined;
      clearMessages();
    }
  }, [id, loadConversation, clearMessages]);

  const handleSelectConversation = (convId: string) => {
    navigate(`/chat/${convId}`);
  };

  const handleDeleteConversation = async (convId: string) => {
    await removeConversation(convId);
    if (id === convId) {
      clearMessages();
      navigate('/chat');
    }
  };

  const handleUpload = async (file: File) => {
    const res = await upload(file);
    if (res) {
      alert(`✅ ${res.filename} indexé — ${res.chunks} fragments`);
    }
  };

  return (
    <div className="flex h-full" style={{ backgroundColor: '#0d0d0d' }}>
      <ChatSidebar
        history={history}
        mode={mode}
        onModeChange={setMode}
        onNewChat={() => { clearMessages(); navigate('/chat'); }}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onUpload={handleUpload}
        currentId={id}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {error && (
          <div className="px-4 pt-3">
            <ErrorMessage message={error} />
          </div>
        )}
        <ChatWindow messages={messages} isLoading={isLoading} />
        <div className="px-4 pb-4 shrink-0">
          <ChatInput
            onSend={send}
            disabled={isLoading}
            precision={precision}
            onPrecisionChange={setPrecision}
          />
        </div>
      </div>
    </div>
  );
}
