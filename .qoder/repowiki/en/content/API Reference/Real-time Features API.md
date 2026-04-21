# Real-time Features API

<cite>
**Referenced Files in This Document**
- [supabase-realtime.ts](file://src/lib/supabase-realtime.ts)
- [live-chat-widget.tsx](file://src/components/dashboard/live-chat-widget.tsx)
- [admin-support-page.tsx](file://src/app/admin/support/page.tsx)
- [conversations.route.ts](file://src/app/api/support/conversations/route.ts)
- [messages.route.ts](file://src/app/api/support/messages/route.ts)
- [public-chat.route.ts](file://src/app/api/support/public-chat/route.ts)
- [stream.route.ts](file://src/app/api/support/stream/route.ts)
- [voice-session.route.ts](file://src/app/api/support/voice-session/route.ts)
- [notifications-send.route.ts](file://src/app/api/notifications/send/route.ts)
- [notifications-subscribe.route.ts](file://src/app/api/notifications/subscribe/route.ts)
- [use-push-notifications.ts](file://src/hooks/use-push-notifications.ts)
- [intelligence-notifications.service.ts](file://src/lib/services/intelligence-notifications.service.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document provides comprehensive API documentation for real-time communication features in the platform. It covers:
- Live chat functionality for authenticated users
- Public chat streams
- Support chat streams with moderation and caching
- Voice session management via OpenAI Realtime
- Notification delivery via Web Push and email

It details WebSocket connection handling, message formatting, event types, real-time data synchronization, authentication, connection management, error handling, and scalability considerations. Practical examples are included for implementing real-time chat and notification subscriptions.

## Project Structure
The real-time features span backend API routes, frontend widgets, and notification utilities:
- Backend APIs under src/app/api support live chat, public chat, streaming, voice sessions, and notifications
- Frontend widgets integrate Supabase Realtime for live updates
- Notification services handle push and email delivery with deduplication and preference filtering

```mermaid
graph TB
subgraph "Frontend"
LCW["Live Chat Widget<br/>live-chat-widget.tsx"]
AP["Admin Page<br/>admin-support-page.tsx"]
UPN["Push Hook<br/>use-push-notifications.ts"]
end
subgraph "Backend"
SC["Supabase Client<br/>supabase-realtime.ts"]
API_CONV["/api/support/conversations<br/>conversations.route.ts"]
API_MSG["/api/support/messages<br/>messages.route.ts"]
API_PUB["/api/support/public-chat<br/>public-chat.route.ts"]
API_STR["/api/support/stream<br/>stream.route.ts"]
API_VOICE["/api/support/voice-session<br/>voice-session.route.ts"]
API_NOT_SEND["/api/notifications/send<br/>notifications-send.route.ts"]
API_NOT_SUB["/api/notifications/subscribe<br/>notifications-subscribe.route.ts"]
end
LCW --> SC
AP --> SC
UPN --> API_NOT_SUB
UPN --> API_NOT_SEND
LCW --> API_CONV
LCW --> API_MSG
LCW --> API_STR
API_PUB --> |"Streams"| LCW
API_STR --> |"Streams"| LCW
API_VOICE --> |"WebSocket"| LCW
```

**Diagram sources**
- [supabase-realtime.ts:1-9](file://src/lib/supabase-realtime.ts#L1-L9)
- [live-chat-widget.tsx:68-294](file://src/components/dashboard/live-chat-widget.tsx#L68-L294)
- [admin-support-page.tsx:50-105](file://src/app/admin/support/page.tsx#L50-L105)
- [conversations.route.ts:1-68](file://src/app/api/support/conversations/route.ts#L1-L68)
- [messages.route.ts:1-64](file://src/app/api/support/messages/route.ts#L1-L64)
- [public-chat.route.ts:1-150](file://src/app/api/support/public-chat/route.ts#L1-L150)
- [stream.route.ts:1-176](file://src/app/api/support/stream/route.ts#L1-L176)
- [voice-session.route.ts:1-202](file://src/app/api/support/voice-session/route.ts#L1-L202)
- [notifications-send.route.ts:1-75](file://src/app/api/notifications/send/route.ts#L1-L75)
- [notifications-subscribe.route.ts:1-61](file://src/app/api/notifications/subscribe/route.ts#L1-L61)
- [use-push-notifications.ts:1-108](file://src/hooks/use-push-notifications.ts#L1-L108)

**Section sources**
- [supabase-realtime.ts:1-9](file://src/lib/supabase-realtime.ts#L1-L9)
- [live-chat-widget.tsx:68-294](file://src/components/dashboard/live-chat-widget.tsx#L68-L294)
- [admin-support-page.tsx:50-105](file://src/app/admin/support/page.tsx#L50-L105)
- [conversations.route.ts:1-68](file://src/app/api/support/conversations/route.ts#L1-L68)
- [messages.route.ts:1-64](file://src/app/api/support/messages/route.ts#L1-L64)
- [public-chat.route.ts:1-150](file://src/app/api/support/public-chat/route.ts#L1-L150)
- [stream.route.ts:1-176](file://src/app/api/support/stream/route.ts#L1-L176)
- [voice-session.route.ts:1-202](file://src/app/api/support/voice-session/route.ts#L1-L202)
- [notifications-send.route.ts:1-75](file://src/app/api/notifications/send/route.ts#L1-L75)
- [notifications-subscribe.route.ts:1-61](file://src/app/api/notifications/subscribe/route.ts#L1-L61)
- [use-push-notifications.ts:1-108](file://src/hooks/use-push-notifications.ts#L1-L108)

## Core Components
- Supabase Realtime client for live Postgres change events
- Live Chat Widget for authenticated support chat with optimistic UI and Supabase channel listeners
- Admin dashboard integration using Supabase channels for live updates
- Support Conversations API for fetching and creating conversations
- Support Messages API for sending user messages with guardrails
- Public Chat API for anonymous users with rate limits and caching
- Support Stream API for agent-assisted streaming with caching and rate limits
- Voice Session API for ephemeral tokens and WebSocket connections
- Notifications Subscribe/ Send APIs for Web Push subscriptions and delivery
- Frontend hook for browser push subscription lifecycle
- Intelligence Notifications service for multi-channel delivery and deduplication

**Section sources**
- [supabase-realtime.ts:1-9](file://src/lib/supabase-realtime.ts#L1-L9)
- [live-chat-widget.tsx:68-294](file://src/components/dashboard/live-chat-widget.tsx#L68-L294)
- [admin-support-page.tsx:50-105](file://src/app/admin/support/page.tsx#L50-L105)
- [conversations.route.ts:1-68](file://src/app/api/support/conversations/route.ts#L1-L68)
- [messages.route.ts:1-64](file://src/app/api/support/messages/route.ts#L1-L64)
- [public-chat.route.ts:1-150](file://src/app/api/support/public-chat/route.ts#L1-L150)
- [stream.route.ts:1-176](file://src/app/api/support/stream/route.ts#L1-L176)
- [voice-session.route.ts:1-202](file://src/app/api/support/voice-session/route.ts#L1-L202)
- [notifications-subscribe.route.ts:1-61](file://src/app/api/notifications/subscribe/route.ts#L1-L61)
- [notifications-send.route.ts:1-75](file://src/app/api/notifications/send/route.ts#L1-L75)
- [use-push-notifications.ts:1-108](file://src/hooks/use-push-notifications.ts#L1-L108)
- [intelligence-notifications.service.ts:1-312](file://src/lib/services/intelligence-notifications.service.ts#L1-L312)

## Architecture Overview
The real-time architecture combines:
- Supabase Realtime for server-sent events on database changes
- Streaming endpoints for AI-assisted chat
- WebSocket endpoints for voice sessions
- Web Push for asynchronous notifications

```mermaid
sequenceDiagram
participant Client as "Browser"
participant Widget as "Live Chat Widget"
participant Supa as "Supabase Realtime"
participant ConvAPI as "Conversations API"
participant MsgAPI as "Messages API"
participant StrAPI as "Stream API"
Client->>Widget : "Open chat widget"
Widget->>ConvAPI : "GET /api/support/conversations"
ConvAPI-->>Widget : "Open conversation or none"
Widget->>Supa : "Listen to 'support : {id}' channel"
Client->>Widget : "User sends message"
Widget->>MsgAPI : "POST /api/support/messages"
MsgAPI-->>Supa : "Insert SupportMessage"
Supa-->>Widget : "INSERT event -> append message"
Widget->>StrAPI : "POST /api/support/stream"
StrAPI-->>Widget : "ReadableStream chunks"
Widget-->>Client : "Render streamed response"
```

**Diagram sources**
- [live-chat-widget.tsx:163-294](file://src/components/dashboard/live-chat-widget.tsx#L163-L294)
- [conversations.route.ts:17-36](file://src/app/api/support/conversations/route.ts#L17-L36)
- [messages.route.ts:13-63](file://src/app/api/support/messages/route.ts#L13-L63)
- [stream.route.ts:31-175](file://src/app/api/support/stream/route.ts#L31-L175)
- [supabase-realtime.ts:1-9](file://src/lib/supabase-realtime.ts#L1-L9)

## Detailed Component Analysis

### Live Chat Widget (Authenticated Support)
The widget manages conversation lifecycle, optimistic rendering, and Supabase channel subscriptions for real-time updates.

Key behaviors:
- Fetches or creates an open conversation per user
- Optimistically appends user messages
- Subscribes to a Supabase channel scoped to the conversation
- Skips displaying agent typing while streaming is active
- Triggers unread indicators when minimized

```mermaid
sequenceDiagram
participant UI as "Live Chat Widget"
participant ConvAPI as "Conversations API"
participant MsgAPI as "Messages API"
participant Supa as "Supabase Realtime"
participant DB as "Postgres"
UI->>ConvAPI : "GET open conversation"
ConvAPI-->>UI : "Conversation or none"
UI->>MsgAPI : "POST user message"
MsgAPI->>DB : "Insert SupportMessage"
DB-->>Supa : "Change event"
Supa-->>UI : "INSERT on 'public.SupportMessage'"
UI->>UI : "Append message (skip agent while streaming)"
UI-->>UI : "Trigger unread if minimized"
```

**Diagram sources**
- [live-chat-widget.tsx:163-210](file://src/components/dashboard/live-chat-widget.tsx#L163-L210)
- [conversations.route.ts:17-36](file://src/app/api/support/conversations/route.ts#L17-L36)
- [messages.route.ts:13-63](file://src/app/api/support/messages/route.ts#L13-L63)
- [supabase-realtime.ts:1-9](file://src/lib/supabase-realtime.ts#L1-L9)

**Section sources**
- [live-chat-widget.tsx:68-294](file://src/components/dashboard/live-chat-widget.tsx#L68-L294)
- [conversations.route.ts:1-68](file://src/app/api/support/conversations/route.ts#L1-L68)
- [messages.route.ts:1-64](file://src/app/api/support/messages/route.ts#L1-L64)

### Admin Dashboard Real-time Updates
The admin page listens for new support conversations and new messages for a selected conversation using Supabase channels.

```mermaid
sequenceDiagram
participant Admin as "Admin Page"
participant Supa as "Supabase Realtime"
participant API as "Admin Conversation API"
Admin->>Supa : "Subscribe 'admin-support' channel"
Supa-->>Admin : "INSERT on SupportConversation"
Admin->>API : "Fetch conversations"
Admin->>Supa : "Subscribe 'admin-conv : {id}' channel"
Supa-->>Admin : "INSERT on SupportMessage"
Admin->>API : "Refresh messages"
```

**Diagram sources**
- [admin-support-page.tsx:50-105](file://src/app/admin/support/page.tsx#L50-L105)
- [supabase-realtime.ts:1-9](file://src/lib/supabase-realtime.ts#L1-L9)

**Section sources**
- [admin-support-page.tsx:50-105](file://src/app/admin/support/page.tsx#L50-L105)
- [supabase-realtime.ts:1-9](file://src/lib/supabase-realtime.ts#L1-L9)

### Support Conversations API
- GET: Returns the user’s open support conversation if eligible (PRO/ELITE/ENTERPRISE)
- POST: Creates a new conversation with optional subject and user context

```mermaid
flowchart TD
Start(["Request"]) --> CheckAuth["Authenticate user"]
CheckAuth --> PlanCheck{"Plan is PRO/ELITE/ENTERPRISE?"}
PlanCheck --> |No| Deny["Return 403"]
PlanCheck --> |Yes| Action{"GET or POST"}
Action --> |GET| Fetch["Find open conversation"]
Action --> |POST| Validate["Validate subject and userContext"]
Validate --> Create["Create conversation"]
Fetch --> Done(["JSON response"])
Create --> Done
Deny --> End(["Exit"])
```

**Diagram sources**
- [conversations.route.ts:17-67](file://src/app/api/support/conversations/route.ts#L17-L67)

**Section sources**
- [conversations.route.ts:1-68](file://src/app/api/support/conversations/route.ts#L1-L68)

### Support Messages API
- Validates presence of conversationId and content
- Prevents AGENT senderRole from being used by clients
- Guardrails: prompt injection detection and PII scrubbing
- Inserts message into database and triggers real-time updates

```mermaid
flowchart TD
Req(["POST /api/support/messages"]) --> Auth["Authenticate user"]
Auth --> Plan["Check plan"]
Plan --> Parse["Parse JSON body"]
Parse --> Fields{"conversationId & content present?"}
Fields --> |No| Err400["Return 400"]
Fields --> |Yes| Role{"senderRole != AGENT?"}
Role --> |No| Err403["Return 403"]
Role --> |Yes| Guard["Guardrails: injection + PII scrub"]
Guard --> Persist["Persist message"]
Persist --> Ok["Return 201 + message"]
```

**Diagram sources**
- [messages.route.ts:13-63](file://src/app/api/support/messages/route.ts#L13-L63)

**Section sources**
- [messages.route.ts:1-64](file://src/app/api/support/messages/route.ts#L1-L64)

### Public Chat Streams (Anonymous)
- Two-tier rate limiting: burst limiter and plan-based daily cap
- Input validation and PII scrubbing
- Static replies and response caching for FAQs
- Streaming with readable stream and caching on completion

```mermaid
sequenceDiagram
participant Client as "Anonymous User"
participant PubAPI as "Public Chat API"
participant Cache as "Response Cache"
participant AI as "AI Model"
Client->>PubAPI : "POST message + history"
PubAPI->>PubAPI : "Burst limit check"
PubAPI->>PubAPI : "Daily limit check"
PubAPI->>PubAPI : "Validate + scrub"
PubAPI->>Cache : "Lookup cached response"
alt "Cached"
Cache-->>PubAPI : "Return cached text"
PubAPI-->>Client : "ReadableStream"
else "No cache"
PubAPI->>AI : "streamText(system, messages)"
AI-->>PubAPI : "Chunks"
PubAPI-->>Client : "ReadableStream"
PubAPI->>Cache : "Store response"
end
```

**Diagram sources**
- [public-chat.route.ts:24-149](file://src/app/api/support/public-chat/route.ts#L24-L149)

**Section sources**
- [public-chat.route.ts:1-150](file://src/app/api/support/public-chat/route.ts#L1-L150)

### Support Stream API (Authenticated)
- Enforces plan eligibility and rate limits
- Validates prompt injection and conversation status
- Builds contextual prompt and caches responses
- Streams agent replies and persists messages after completion

```mermaid
sequenceDiagram
participant Client as "Authenticated User"
participant StrAPI as "Stream API"
participant Cache as "Response Cache"
participant AI as "AI Model"
participant DB as "Postgres"
Client->>StrAPI : "POST conversationId + content"
StrAPI->>StrAPI : "Rate limit + guardrails"
StrAPI->>StrAPI : "Build prompt + cache lookup"
alt "Static reply"
StrAPI-->>Client : "Immediate static reply"
else "Cached"
StrAPI-->>Client : "Cached stream"
else "LLM"
StrAPI->>AI : "streamText(system, messages)"
AI-->>StrAPI : "Chunks"
StrAPI-->>Client : "ReadableStream"
StrAPI->>DB : "Persist agent message"
StrAPI->>Cache : "Store response"
end
```

**Diagram sources**
- [stream.route.ts:31-175](file://src/app/api/support/stream/route.ts#L31-L175)

**Section sources**
- [stream.route.ts:1-176](file://src/app/api/support/stream/route.ts#L1-L176)

### Voice Session Management
- Issues ephemeral tokens from OpenAI Realtime
- Enforces per-user concurrency with Redis
- Builds contextual voice instructions from user data and knowledge base
- Returns WebSocket URL and model configuration for client-side connection

```mermaid
sequenceDiagram
participant Client as "Browser"
participant VoiceAPI as "Voice Session API"
participant Redis as "Redis"
participant KB as "Knowledge Base"
participant OpenAI as "OpenAI Realtime"
Client->>VoiceAPI : "GET /api/support/voice-session?page={...}"
VoiceAPI->>VoiceAPI : "Auth + plan + rate limit"
VoiceAPI->>Redis : "Acquire concurrency lock"
alt "Lock acquired"
VoiceAPI->>OpenAI : "POST client_secrets"
OpenAI-->>VoiceAPI : "ephemeralKey"
VoiceAPI->>KB : "Search + fetch global notes"
VoiceAPI-->>Client : "{mode, ephemeralKey, wssUrl, model, voice, instructions}"
else "Locked"
VoiceAPI-->>Client : "429 Too Many Requests"
end
```

**Diagram sources**
- [voice-session.route.ts:26-201](file://src/app/api/support/voice-session/route.ts#L26-L201)

**Section sources**
- [voice-session.route.ts:1-202](file://src/app/api/support/voice-session/route.ts#L1-L202)

### Notifications: Subscribe and Send
- Subscribe endpoint stores or removes push subscription and toggles enablement
- Send endpoint validates subscription, sends Web Push, logs notification, and handles stale subscriptions
- Frontend hook manages browser permissions, subscription lifecycle, and server sync

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant Hook as "usePushNotifications"
participant SubAPI as "Notifications Subscribe API"
participant SendAPI as "Notifications Send API"
participant VAPID as "VAPID Keys"
participant Push as "Push Service"
Browser->>Hook : "Request permission"
Hook->>Browser : "Subscribe via PushManager"
Hook->>SubAPI : "POST subscription + enabled"
SubAPI-->>Hook : "Success"
Browser->>SendAPI : "POST title/body/icon/url/type/symbol"
SendAPI->>VAPID : "Initialize if needed"
SendAPI->>Push : "sendNotification(subscription, payload)"
Push-->>SendAPI : "Result"
SendAPI-->>Browser : "Success or cleanup on 410/404"
```

**Diagram sources**
- [use-push-notifications.ts:48-104](file://src/hooks/use-push-notifications.ts#L48-L104)
- [notifications-subscribe.route.ts:9-41](file://src/app/api/notifications/subscribe/route.ts#L9-L41)
- [notifications-send.route.ts:27-74](file://src/app/api/notifications/send/route.ts#L27-L74)

**Section sources**
- [use-push-notifications.ts:1-108](file://src/hooks/use-push-notifications.ts#L1-L108)
- [notifications-subscribe.route.ts:1-61](file://src/app/api/notifications/subscribe/route.ts#L1-L61)
- [notifications-send.route.ts:1-75](file://src/app/api/notifications/send/route.ts#L1-L75)

### Intelligence Notifications Service
- Builds notification events from dashboard/home data
- Respects user preferences and cadence rules
- Deduplicates events using Redis TTL keys
- Sends Web Push and/or email via Brevo, returning delivery results

```mermaid
flowchart TD
Start(["Event Source"]) --> Build["Build IntelligenceNotificationEvent"]
Build --> Pref["Load user preferences"]
Pref --> CheckPrefs{"Allowed by type + cadence?"}
CheckPrefs --> |No| Suppress["Suppress delivery"]
CheckPrefs --> |Yes| Dedup["Check Redis dedupe key"]
Dedup --> |Exists| Suppress
Dedup --> |New| Store["Persist notification record"]
Store --> Push{"Push enabled + subscription?"}
Store --> Email{"Email enabled + address?"}
Push --> |Yes| SendPush["Send Web Push"]
Push --> |No| SkipPush["Skip"]
Email --> |Yes| SendEmail["Send via Brevo"]
Email --> |No| SkipEmail["Skip"]
SendPush --> Done(["Return results"])
SendEmail --> Done
SkipPush --> Done
SkipEmail --> Done
Suppress --> End(["Exit"])
```

**Diagram sources**
- [intelligence-notifications.service.ts:217-311](file://src/lib/services/intelligence-notifications.service.ts#L217-L311)

**Section sources**
- [intelligence-notifications.service.ts:1-312](file://src/lib/services/intelligence-notifications.service.ts#L1-L312)

## Dependency Analysis
- Supabase Realtime is a shared dependency used by the live chat widget and admin page for server-sent events
- Support APIs depend on authentication, plan gating, rate limiting, guardrails, and persistence
- Voice session API depends on OpenAI ephemeral tokens and Redis for concurrency
- Notification APIs depend on VAPID configuration and external push services
- Intelligence notifications service integrates Prisma, Redis, and Brevo

```mermaid
graph LR
Supa["Supabase Realtime"] --> LCW["Live Chat Widget"]
Supa --> Admin["Admin Page"]
LCW --> ConvAPI["Conversations API"]
LCW --> MsgAPI["Messages API"]
LCW --> StrAPI["Stream API"]
PubAPI["Public Chat API"] --> Cache["Response Cache"]
StrAPI --> Cache
VoiceAPI["Voice Session API"] --> Redis["Redis"]
VoiceAPI --> OpenAI["OpenAI Realtime"]
NotSub["Notifications Subscribe API"] --> VAPID["VAPID Keys"]
NotSend["Notifications Send API"] --> VAPID
NotSend --> Push["Push Service"]
IntNot["Intelligence Notifications Service"] --> Prisma["Prisma"]
IntNot --> Redis
IntNot --> Brevo["Brevo Email"]
```

**Diagram sources**
- [supabase-realtime.ts:1-9](file://src/lib/supabase-realtime.ts#L1-L9)
- [live-chat-widget.tsx:180-210](file://src/components/dashboard/live-chat-widget.tsx#L180-L210)
- [admin-support-page.tsx:50-105](file://src/app/admin/support/page.tsx#L50-L105)
- [conversations.route.ts:1-68](file://src/app/api/support/conversations/route.ts#L1-L68)
- [messages.route.ts:1-64](file://src/app/api/support/messages/route.ts#L1-L64)
- [stream.route.ts:1-176](file://src/app/api/support/stream/route.ts#L1-L176)
- [public-chat.route.ts:1-150](file://src/app/api/support/public-chat/route.ts#L1-L150)
- [voice-session.route.ts:1-202](file://src/app/api/support/voice-session/route.ts#L1-L202)
- [notifications-subscribe.route.ts:1-61](file://src/app/api/notifications/subscribe/route.ts#L1-L61)
- [notifications-send.route.ts:1-75](file://src/app/api/notifications/send/route.ts#L1-L75)
- [intelligence-notifications.service.ts:1-312](file://src/lib/services/intelligence-notifications.service.ts#L1-L312)

**Section sources**
- [supabase-realtime.ts:1-9](file://src/lib/supabase-realtime.ts#L1-L9)
- [live-chat-widget.tsx:180-210](file://src/components/dashboard/live-chat-widget.tsx#L180-L210)
- [admin-support-page.tsx:50-105](file://src/app/admin/support/page.tsx#L50-L105)
- [stream.route.ts:1-176](file://src/app/api/support/stream/route.ts#L1-L176)
- [voice-session.route.ts:1-202](file://src/app/api/support/voice-session/route.ts#L1-L202)
- [notifications-send.route.ts:1-75](file://src/app/api/notifications/send/route.ts#L1-L75)
- [intelligence-notifications.service.ts:1-312](file://src/lib/services/intelligence-notifications.service.ts#L1-L312)

## Performance Considerations
- Streaming endpoints set explicit max durations and preferred regions to optimize cold starts and edge routing
- Public and authenticated chat endpoints implement dual rate limiting to mitigate abuse and control cost
- Response caching reduces LLM calls for repeated prompts
- Supabase channels minimize polling and provide immediate updates
- Voice session concurrency lock prevents unbounded audio sessions
- Web Push delivery is fire-and-forget with cleanup for stale subscriptions

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Unauthorized or insufficient plan: Ensure authentication and plan checks pass before calling chat or voice endpoints
- Rate limit exceeded: Respect burst and daily caps; implement client-side backoff
- Prompt injection detected: Sanitized inputs are rejected; validate and scrub content upstream
- Stale push subscription: On 410/404, remove local subscription and re-subscribe
- Voice session concurrency: Only one active session per user; wait for the current session to finish
- Supabase channel errors: Ensure the client is initialized and channels are unsubscribed on unmount

**Section sources**
- [stream.route.ts:31-45](file://src/app/api/support/stream/route.ts#L31-L45)
- [public-chat.route.ts:24-40](file://src/app/api/support/public-chat/route.ts#L24-L40)
- [messages.route.ts:36-41](file://src/app/api/support/messages/route.ts#L36-L41)
- [notifications-send.route.ts:62-70](file://src/app/api/notifications/send/route.ts#L62-L70)
- [voice-session.route.ts:44-49](file://src/app/api/support/voice-session/route.ts#L44-L49)
- [live-chat-widget.tsx:180-210](file://src/components/dashboard/live-chat-widget.tsx#L180-L210)

## Conclusion
The platform provides a robust real-time communication stack:
- Live chat with optimistic UI and Supabase channels
- Public and authenticated streaming with guardrails and caching
- Voice sessions with ephemeral tokens and concurrency control
- Web Push and email notifications with deduplication and preference-aware delivery

These components are designed for scalability, security, and maintainability, with clear separation of concerns across backend APIs, frontend widgets, and notification services.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### API Reference Summary

- Support Conversations
  - GET /api/support/conversations
    - Auth: required
    - Plan: PRO/ELITE/ENTERPRISE
    - Response: open conversation or none
  - POST /api/support/conversations
    - Auth: required
    - Plan: PRO/ELITE/ENTERPRISE
    - Body: subject (optional), userContext (optional)
    - Response: created conversation

- Support Messages
  - POST /api/support/messages
    - Auth: required
    - Plan: PRO/ELITE/ENTERPRISE
    - Body: conversationId, content, senderRole (must not be AGENT)
    - Response: created message

- Public Chat Streams
  - POST /api/support/public-chat
    - Auth: optional
    - Body: message, history (optional)
    - Response: text/plain stream
    - Rate limits: burst + daily

- Support Stream (Agent-assisted)
  - POST /api/support/stream
    - Auth: required
    - Plan: PRO/ELITE/ENTERPRISE
    - Body: conversationId, content
    - Response: text/plain stream
    - Rate limits: per plan

- Voice Session
  - GET /api/support/voice-session
    - Auth: required
    - Plan: PRO/ELITE/ENTERPRISE
    - Query: page (optional)
    - Response: { mode, ephemeralKey, wssUrl, model, voice, instructions }
    - Concurrency: per-user lock

- Notifications Subscribe
  - POST /api/notifications/subscribe
    - Auth: required
    - Body: subscription (JSON), enabled (boolean)
    - Response: success
  - DELETE /api/notifications/subscribe
    - Auth: required
    - Response: success

- Notifications Send
  - POST /api/notifications/send
    - Auth: required
    - Body: title, body, icon (optional), url (optional), type (optional), symbol (optional)
    - Response: success or cleanup on stale subscription

**Section sources**
- [conversations.route.ts:1-68](file://src/app/api/support/conversations/route.ts#L1-L68)
- [messages.route.ts:1-64](file://src/app/api/support/messages/route.ts#L1-L64)
- [public-chat.route.ts:1-150](file://src/app/api/support/public-chat/route.ts#L1-L150)
- [stream.route.ts:1-176](file://src/app/api/support/stream/route.ts#L1-L176)
- [voice-session.route.ts:1-202](file://src/app/api/support/voice-session/route.ts#L1-L202)
- [notifications-subscribe.route.ts:1-61](file://src/app/api/notifications/subscribe/route.ts#L1-L61)
- [notifications-send.route.ts:1-75](file://src/app/api/notifications/send/route.ts#L1-L75)