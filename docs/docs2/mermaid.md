flowchart TB
  subgraph User_Surfaces[User-Facing AI Surfaces]
    Chat[Lyra Chat / Market Q&A]
    Related[Related Follow-up Questions]
    Trending[Trending Questions]
    Briefing[Daily Market Briefing]
    Discovery[Discovery Explanation]
    Support[Myra Support Chat]
    PublicSupport[Public Support Chat]
    Portfolio[Portfolio Intelligence UI]
    PersonalBriefing[Personal Briefing]
    WhatsChanged[What's Changed]
    Analogs[Historical Analogs]
    Feedback[Lyra Feedback + History]
    AdminStats[Myra Admin Stats]
  end

  subgraph Model_Api_Layer[Model / API Layer]
    StreamText[AI SDK streamText]
    GenerateText[AI SDK generateText]
    GenerateObject[AI SDK generateObject]
    AzureChat[Azure OpenAI GPT-5.4 deployments]
    Embeddings[Azure OpenAI Embeddings]
    RawChat[OpenAI chat.completions.create]
    WebSearch[searchWeb live research]
  end

  subgraph Deterministic_Layer[Deterministic Intelligence Layer]
    PortfolioEngines[Portfolio health / fragility / Monte Carlo / benchmarks]
    BriefingSvc[DailyBriefingService]
    NarrativeSvc[MarketNarrativesService]
    PersonalSvc[PersonalBriefingService]
    WatchlistDelta[What\'s Changed engine]
    AnalogEngine[Historical analog engine]
    PrismaDB[Prisma + Postgres]
    RedisCache[Redis / SWR / Next cache]
  end

  Chat --> StreamText --> AzureChat
  Chat --> WebSearch
  Chat --> PrismaDB
  Chat --> RedisCache

  Related --> GenerateObject --> AzureChat
  Trending --> GenerateText --> AzureChat
  Briefing --> GenerateText --> AzureChat
  Discovery --> RawChat --> AzureChat

  Support --> StreamText --> AzureChat
  PublicSupport --> StreamText --> AzureChat
  Support --> Embeddings
  PublicSupport --> Embeddings
  Support --> RedisCache
  PublicSupport --> RedisCache

  Portfolio --> PortfolioEngines
  PersonalBriefing --> PersonalSvc --> PrismaDB
  WhatsChanged --> WatchlistDelta --> PrismaDB
  Analogs --> AnalogEngine --> PrismaDB
  Briefing --> BriefingSvc --> PrismaDB
  NarrativeSvc --> PrismaDB
  Feedback --> PrismaDB
  AdminStats --> PrismaDB