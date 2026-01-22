# SPLIT-IT: WEB-BASED EXPENSE SHARING AND SETTLEMENT APPLICATION

**A Project Report**

**Submitted by:**

[Student Name 1] ([Registration Number])
[Student Name 2] ([Registration Number])
[Student Name 3] ([Registration Number])
[Student Name 4] ([Registration Number])

in partial fulfillment for the award of the degree of

**BACHELOR OF TECHNOLOGY**

IN

**COMPUTER SCIENCE & INFORMATION TECHNOLOGY**

**DEPARTMENT OF COMPUTER SCIENCE & INFORMATION TECHNOLOGY**
Faculty of Engineering and Technology, Institute of Technical Education and Research
**SIKSHA 'O' ANUSANDHAN (DEEMED TO BE) UNIVERSITY**
Bhubaneswar, Odisha, India

**(June 2024)**

---

## CERTIFICATE

This is to certify that the project report titled "**Split-It: Web-Based Expense Sharing and Settlement Application**" being submitted by [Names of students and Section] to the Institute of Technical Education and Research, Siksha 'O' Anusandhan (Deemed to be) University, Bhubaneswar for the partial fulfillment for the degree of Bachelor of Technology in Computer Science and Information Technology is a record of original bonafide work carried out by them under my supervision and guidance. The project work, in my opinion, has reached the requisite standard fulfilling the requirements for the degree of Bachelor of Technology.

The results contained in this report have not been submitted in part or full to any other University or Institute for the award of any degree or diploma.

**[Name of Supervisor]**
Department of Computer Science and Information Technology
Faculty of Engineering and Technology
Institute of Technical Education and Research
Siksha 'O' Anusandhan (Deemed to be) University

---

## ACKNOWLEDGEMENT

We would like to express our sincere gratitude to all those who have contributed to the successful completion of this project.

We are deeply thankful to our project guide, **[Guide Name]**, for their invaluable guidance, continuous support, and encouragement throughout the development of this project. Their expertise and insights have been instrumental in shaping this work.

We extend our appreciation to **[HOD Name]**, Head of the Department of Computer Science and Information Technology, for providing us with the necessary facilities and resources to carry out this project.

We are grateful to all the faculty members of the Department of Computer Science and Information Technology for their support and valuable suggestions during various stages of the project.

We would also like to thank our family and friends for their constant encouragement and moral support throughout this journey.

Finally, we acknowledge the use of various open-source libraries and frameworks that made the development of this application possible.

**Place:** Bhubaneswar
**Date:** [Date]

**Signature of Students:**
[Student 1]
[Student 2]
[Student 3]
[Student 4]

---

## DECLARATION

We declare that this written submission represents our ideas in our own words and where other's ideas or words have been included, we have adequately cited and referenced the original sources. We also declare that we have adhered to all principles of academic honesty and integrity and have not misrepresented or fabricated or falsified any idea/fact/source in our submission. We understand that any violation of the above will cause for disciplinary action by the University and can also evoke penal action from the sources which have not been properly cited or from whom proper permission has not been taken when needed.

**Signature of Students with Registration Numbers:**

[Student 1 Name] - [Registration Number]
[Student 2 Name] - [Registration Number]
[Student 3 Name] - [Registration Number]
[Student 4 Name] - [Registration Number]

**Date:** [Date]

---

## REPORT APPROVAL

This project report entitled "**Split-It: Web-Based Expense Sharing and Settlement Application**" by [Names of students] is approved for the degree of Bachelor of Technology in Computer Science & Information Technology.

**Examiners:**

_______________________________

_______________________________

---

## ABSTRACT

Managing shared expenses among groups has always been a challenging task, often leading to confusion, disputes, and strained relationships. Split-It is a comprehensive web-based expense sharing and settlement application designed to simplify the process of tracking, splitting, and settling shared expenses among friends, family, roommates, and groups.

The application provides an intuitive platform where users can create multiple groups, add expenses with flexible splitting options (equal, exact amount, percentage, and itemized), and track who owes whom. The system employs an intelligent debt simplification algorithm that minimizes the number of transactions required to settle all balances within a group, making settlements efficient and straightforward.

Built using modern web technologies including React for the frontend and Node.js with Express for the backend, Split-It leverages MongoDB for flexible data storage and Socket.IO for real-time updates. The application implements a Progressive Web App (PWA) architecture, enabling offline functionality and native app-like experience across all devices.

Key features include multi-currency support, recurring expense management, receipt uploads, real-time group chat, push and email notifications, payment confirmation workflow, and comprehensive analytics. The application ensures security through JWT-based authentication, bcrypt password hashing, and implements best practices for data protection.

The project successfully demonstrates the practical application of full-stack web development principles, real-time communication protocols, database design, and user experience optimization. Split-It addresses a real-world problem with a scalable, maintainable, and user-friendly solution that can be deployed in production environments.

---

## TABLE OF CONTENTS

| Section | Page |
|---------|------|
| Certificate | ii |
| Acknowledgement | iii |
| Declaration | iv |
| Report Approval | v |
| Abstract | vi |
| Table of Contents | vii |
| List of Figures | ix |
| List of Tables | x |
| Timeline / Gantt Chart | xi |
| **Chapter 1: Introduction** | **1** |
| 1.1 Background | 1 |
| 1.2 Literature Review | 3 |
| 1.3 Problem Definition | 6 |
| 1.4 Objectives of Work | 7 |
| 1.5 Work Plan | 8 |
| **Chapter 2: Design and Methodology** | **10** |
| 2.1 Alternative Design Ideas | 10 |
| 2.2 Design Criteria and Comparison | 12 |
| 2.3 Evaluation and Selection | 14 |
| 2.4 Detailed System Design | 15 |
| 2.4.1 System Architecture | 15 |
| 2.4.2 Database Design | 17 |
| 2.4.3 API Design | 20 |
| 2.4.4 Frontend Architecture | 22 |
| 2.4.5 Real-time Communication | 24 |
| 2.4.6 Authentication and Security | 26 |
| 2.4.7 Settlement Algorithm | 28 |
| **Chapter 3: Implementation** | **30** |
| 3.1 Development Environment Setup | 30 |
| 3.2 Backend Implementation | 31 |
| 3.3 Frontend Implementation | 35 |
| 3.4 Database Implementation | 38 |
| 3.5 Real-time Features Implementation | 40 |
| 3.6 Authentication Implementation | 42 |
| 3.7 Notification System Implementation | 44 |
| 3.8 PWA Implementation | 46 |
| **Chapter 4: Results and Discussion** | **48** |
| 4.1 Application Features | 48 |
| 4.2 User Interface | 52 |
| 4.3 Performance Analysis | 56 |
| 4.4 Testing and Validation | 58 |
| 4.5 Deployment | 60 |
| 4.6 Limitations and Challenges | 62 |
| **Chapter 5: Conclusions and Future Scope** | **64** |
| 5.1 Conclusions | 64 |
| 5.2 Achievement of Objectives | 65 |
| 5.3 Future Scope | 66 |
| **Reflection on the Design Process** | **68** |
| **References** | **70** |
| **Appendices** | **72** |
| Appendix 1: User Manual | 72 |
| Appendix 2: API Documentation | 75 |
| Appendix 3: Database Schema | 78 |
| Appendix 4: Similarity Report | 80 |

---

## LIST OF FIGURES

| Figure No. | Title | Page |
|------------|-------|------|
| 1.1 | Expense Sharing Workflow | 2 |
| 2.1 | System Architecture Diagram | 16 |
| 2.2 | Database Entity Relationship Diagram | 18 |
| 2.3 | API Architecture | 21 |
| 2.4 | Frontend Component Hierarchy | 23 |
| 2.5 | Real-time Communication Flow | 25 |
| 2.6 | Authentication Flow Diagram | 27 |
| 2.7 | Settlement Algorithm Flowchart | 29 |
| 3.1 | Project Directory Structure | 31 |
| 3.2 | Backend Module Organization | 33 |
| 3.3 | React Component Structure | 36 |
| 3.4 | Socket.IO Event Flow | 41 |
| 3.5 | JWT Authentication Process | 43 |
| 3.6 | Push Notification Architecture | 45 |
| 4.1 | Dashboard Interface | 53 |
| 4.2 | Group Detail Page | 54 |
| 4.3 | Expense Creation Form | 55 |
| 4.4 | Settlement Suggestions View | 56 |
| 4.5 | Performance Metrics | 57 |
| 4.6 | Deployment Architecture | 61 |

---

## LIST OF TABLES

| Table No. | Title | Page |
|-----------|-------|------|
| 1.1 | Comparison of Existing Solutions | 5 |
| 2.1 | Design Alternatives Comparison | 13 |
| 2.2 | Database Collections Overview | 19 |
| 2.3 | API Endpoints Summary | 22 |
| 2.4 | Security Measures Implemented | 27 |
| 3.1 | Technology Stack | 30 |
| 3.2 | Backend Dependencies | 32 |
| 3.3 | Frontend Dependencies | 35 |
| 3.4 | Socket.IO Events | 40 |
| 4.1 | Feature Implementation Status | 49 |
| 4.2 | Test Coverage Summary | 59 |
| 4.3 | Performance Benchmarks | 57 |

---

## TIMELINE / GANTT CHART

| Phase | Activity | Week 1-2 | Week 3-4 | Week 5-6 | Week 7-8 | Week 9-10 | Week 11-12 |
|-------|----------|----------|----------|----------|----------|-----------|------------|
| **Planning** | Requirement Analysis | ████ | | | | | |
| | Literature Review | ████ | ████ | | | | |
| | System Design | | ████ | ████ | | | |
| **Development** | Database Setup | | | ████ | | | |
| | Backend API Development | | | ████ | ████ | | |
| | Frontend Development | | | | ████ | ████ | |
| | Real-time Features | | | | | ████ | |
| | Authentication System | | | ████ | ████ | | |
| **Testing** | Unit Testing | | | | ████ | ████ | |
| | Integration Testing | | | | | ████ | ████ |
| **Deployment** | Production Setup | | | | | | ████ |
| | Documentation | | | | | ████ | ████ |

---

# CHAPTER 1: INTRODUCTION

## 1.1 Background

### 1.1.1 Context and Motivation

In today's interconnected world, people frequently share expenses in various scenarios - roommates splitting rent and utilities, friends sharing travel costs, colleagues managing team lunches, or families tracking household expenses. However, managing these shared expenses manually often leads to confusion, forgotten debts, calculation errors, and sometimes even conflicts that can strain relationships.

Traditional methods of expense tracking, such as maintaining spreadsheets, using pen and paper, or relying on memory, are prone to errors and lack transparency. When multiple people are involved in numerous transactions over time, keeping track of who owes whom becomes increasingly complex. The situation becomes even more challenging when dealing with multiple groups simultaneously, different currencies, or recurring expenses.

The need for a digital solution that can automate expense tracking, provide transparent calculations, and simplify settlements has become increasingly apparent. Such a solution should not only track expenses but also optimize the settlement process by minimizing the number of transactions required to balance all debts within a group.

### 1.1.2 Scope of the Application

Split-It is designed to address these challenges by providing a comprehensive web-based platform for expense management and settlement. The application caters to various use cases:

**Personal Finance Management:** Individuals can track their shared expenses across multiple groups and get a consolidated view of their financial obligations.

**Group Expense Tracking:** Groups can collaboratively manage expenses with complete transparency, where every member can see all transactions and their individual balances.

**Smart Settlement:** The application employs intelligent algorithms to suggest optimal settlement paths, reducing the number of transactions needed to clear all debts.

**Real-time Collaboration:** Members can communicate through integrated group chat, receive instant notifications about new expenses, and see live updates when others make changes.

**Multi-platform Access:** As a Progressive Web App, Split-It works seamlessly across desktop, mobile, and tablet devices, with offline capabilities for viewing cached data.

### 1.1.3 Target Users

The application is designed for:

- **Roommates and Flatmates:** Managing rent, utilities, groceries, and household expenses
- **Travel Groups:** Tracking expenses during trips, vacations, or group tours
- **Student Groups:** Sharing costs for projects, events, or daily expenses
- **Families:** Managing household budgets and shared family expenses
- **Professional Teams:** Tracking team lunches, office supplies, or event costs
- **Event Organizers:** Managing expenses for parties, weddings, or group events

### 1.1.4 Problem Context

The complexity of shared expense management increases exponentially with the number of people and transactions involved. Consider a scenario where five friends go on a week-long trip. Person A pays for accommodation, Person B pays for meals, Person C pays for transportation, Person D pays for activities, and Person E pays for groceries. At the end of the trip, calculating who owes whom requires:

1. Summing up all expenses
2. Calculating each person's share based on their participation in each expense
3. Determining net balances for each person
4. Optimizing settlements to minimize the number of transactions

Doing this manually is time-consuming and error-prone. Split-It automates this entire process, providing instant calculations and settlement suggestions.

---

## 1.2 Literature Review

### 1.2.1 Existing Solutions Analysis

Several expense-sharing applications exist in the market, each with its own approach and feature set. A comprehensive analysis of existing solutions was conducted to understand their strengths, weaknesses, and opportunities for improvement.

**Splitwise:**
Splitwise is one of the most popular expense-sharing applications globally. It offers features like expense tracking, debt simplification, and multi-currency support. The application uses a freemium model with premium features like receipt scanning and expense search. However, Splitwise has limitations in terms of real-time collaboration features and lacks integrated group communication.

**Settle Up:**
Settle Up focuses on simplicity and ease of use. It provides basic expense tracking and settlement features with a clean interface. The application supports multiple currencies and offers various settlement methods. However, it lacks advanced features like recurring expenses, detailed analytics, and real-time notifications.

**Tricount:**
Tricount is designed specifically for group trips and events. It offers expense tracking with a focus on travel scenarios. The application provides good visualization of balances but has limited features for ongoing expense management like recurring bills or long-term group management.

**Venmo/PayPal:**
While primarily payment platforms, Venmo and PayPal offer social features for splitting expenses. However, they focus more on the payment transaction itself rather than comprehensive expense tracking and management. They lack features like debt optimization, detailed expense categorization, and group-level analytics.

### 1.2.2 Technology Review

**Frontend Technologies:**
Modern web applications leverage component-based frameworks for building interactive user interfaces. React has emerged as a leading choice due to its virtual DOM, component reusability, and extensive ecosystem. The introduction of hooks in React has simplified state management and side effects handling.

**Backend Technologies:**
Node.js with Express provides a lightweight, efficient runtime for building RESTful APIs. Its non-blocking I/O model makes it suitable for real-time applications. MongoDB, a NoSQL database, offers flexibility in schema design and scales well for applications with evolving data structures.

**Real-time Communication:**
Socket.IO has become the de facto standard for implementing WebSocket-based real-time communication in web applications. It provides automatic fallback mechanisms and handles connection management efficiently.

**Progressive Web Apps:**
PWA technology enables web applications to provide native app-like experiences, including offline functionality, push notifications, and home screen installation. Service workers form the backbone of PWA capabilities.

### 1.2.3 Algorithmic Approaches

**Debt Simplification Algorithms:**
Research in graph theory provides several approaches to debt simplification:

1. **Greedy Algorithm:** Iteratively settles the largest debt first. While not always optimal, it provides good results with O(n²) complexity.

2. **Network Flow Approach:** Models debts as a flow network and uses algorithms like Ford-Fulkerson to find optimal settlements. Provides optimal solutions but with higher computational complexity.

3. **Minimum Transaction Algorithm:** Uses a priority queue-based approach to minimize the number of transactions. Balances optimality with computational efficiency.

Split-It implements a hybrid approach that combines greedy optimization with transaction minimization to provide efficient settlements in real-time.

### 1.2.4 Security Considerations

Modern web applications must implement robust security measures:

- **Authentication:** JWT (JSON Web Tokens) provide stateless authentication suitable for distributed systems
- **Password Security:** bcrypt hashing with salt rounds protects against rainbow table attacks
- **Data Protection:** HTTPS encryption, CORS policies, and security headers prevent common vulnerabilities
- **Input Validation:** Server-side validation prevents injection attacks and ensures data integrity

### 1.2.5 Gaps in Existing Solutions

Through the literature review and analysis of existing solutions, several gaps were identified:

1. **Limited Real-time Collaboration:** Most applications lack integrated communication features, requiring users to coordinate through external channels.

2. **Complex User Interfaces:** Many solutions overwhelm users with features, making simple tasks complicated.

3. **Inadequate Mobile Experience:** While mobile apps exist, the web versions often provide suboptimal mobile experiences.

4. **Missing Payment Confirmation:** Existing solutions assume settlements are completed once recorded, lacking verification mechanisms.

5. **Limited Analytics:** Most applications provide basic balance information but lack comprehensive spending insights and trends.

6. **Inflexible Splitting Options:** Many solutions support only equal splits or require manual calculation for complex scenarios.

Split-It was designed to address these gaps by providing a comprehensive, user-friendly solution with advanced features while maintaining simplicity in core workflows.

### 1.2.6 Comparison of Existing Solutions

| Feature | Splitwise | Settle Up | Tricount | Split-It |
|---------|-----------|-----------|----------|----------|
| Expense Tracking | ✓ | ✓ | ✓ | ✓ |
| Multiple Split Types | Limited | ✓ | Limited | ✓ (4 types) |
| Debt Simplification | ✓ | ✓ | ✓ | ✓ (Optimized) |
| Real-time Updates | Limited | ✗ | ✗ | ✓ |
| Group Chat | ✗ | ✗ | ✗ | ✓ |
| Payment Confirmation | ✗ | ✗ | ✗ | ✓ |
| Recurring Expenses | Premium | ✗ | ✗ | ✓ |
| Receipt Upload | Premium | ✗ | ✗ | ✓ |
| PWA Support | ✗ | Limited | ✗ | ✓ |
| Analytics Dashboard | Limited | Basic | Basic | ✓ (Comprehensive) |
| Multi-currency | ✓ | ✓ | ✓ | ✓ |
| Offline Mode | ✗ | ✗ | ✗ | ✓ |
| Push Notifications | ✓ | Limited | ✗ | ✓ |
| Email Notifications | ✓ | ✗ | ✗ | ✓ |
| Open Source | ✗ | ✗ | ✗ | ✓ |

---

## 1.3 Problem Definition

### 1.3.1 Core Problem Statement

Design and develop a comprehensive web-based expense sharing and settlement application that enables users to efficiently track, split, and settle shared expenses across multiple groups while providing real-time collaboration features, intelligent settlement optimization, and a seamless user experience across all devices.

### 1.3.2 Specific Problems to Address

**Problem 1: Complex Expense Tracking**
Users need a simple way to record expenses with flexible splitting options that accommodate various real-world scenarios (equal splits, exact amounts, percentages, itemized bills).

**Problem 2: Settlement Complexity**
When multiple people owe money to multiple others, determining the optimal way to settle all debts with minimum transactions is computationally challenging.

**Problem 3: Lack of Transparency**
Group members need complete visibility into all expenses, their individual contributions, and current balances to avoid disputes and maintain trust.

**Problem 4: Communication Gap**
Expense-related discussions often happen outside the tracking application, leading to context loss and coordination difficulties.

**Problem 5: Payment Verification**
Recording a settlement doesn't guarantee that payment was actually made or received, leading to potential discrepancies.

**Problem 6: Multi-device Access**
Users need to access the application from various devices (desktop, mobile, tablet) with consistent experience and offline capabilities.

**Problem 7: Notification Management**
Users need timely notifications about new expenses, settlements, and payment requests without being overwhelmed.

**Problem 8: Data Security**
Sensitive financial information must be protected through robust authentication, authorization, and encryption mechanisms.

### 1.3.3 Success Criteria

The application will be considered successful if it:

1. Enables users to create and manage multiple expense groups
2. Supports at least four different expense splitting methods
3. Implements debt simplification algorithm that reduces transactions by at least 40%
4. Provides real-time updates with latency under 500ms
5. Achieves 95%+ uptime in production environment
6. Supports offline viewing of cached data
7. Implements secure authentication with industry-standard practices
8. Provides responsive UI that works on devices from 320px to 4K displays
9. Achieves Lighthouse PWA score above 90
10. Maintains response times under 200ms for API calls

---

## 1.4 Objectives of Work

### 1.4.1 Primary Objectives

**Objective 1: Develop a Full-Stack Web Application**
Create a complete web application using modern technologies (React, Node.js, MongoDB) that demonstrates proficiency in full-stack development, including frontend design, backend API development, database management, and deployment.

**Objective 2: Implement Intelligent Settlement Algorithm**
Design and implement a debt simplification algorithm that minimizes the number of transactions required to settle all balances within a group, demonstrating understanding of graph theory and algorithmic optimization.

**Objective 3: Enable Real-time Collaboration**
Integrate WebSocket-based real-time communication to provide instant updates for expenses, settlements, and group chat, showcasing knowledge of real-time web technologies.

**Objective 4: Ensure Security and Privacy**
Implement comprehensive security measures including JWT authentication, password hashing, input validation, and secure data transmission to protect user information and financial data.

**Objective 5: Create Progressive Web App**
Develop a PWA that provides native app-like experience with offline capabilities, push notifications, and installability across all platforms.

### 1.4.2 Secondary Objectives

**Objective 6: Optimize User Experience**
Design an intuitive, responsive user interface that works seamlessly across desktop, tablet, and mobile devices with consistent experience.

**Objective 7: Implement Comprehensive Testing**
Develop unit tests, integration tests, and end-to-end tests to ensure application reliability and maintainability.

**Objective 8: Enable Scalable Deployment**
Deploy the application on cloud infrastructure with proper configuration for production environment, demonstrating DevOps knowledge.

**Objective 9: Provide Analytics and Insights**
Implement data visualization and analytics features that help users understand their spending patterns and group dynamics.

**Objective 10: Document Thoroughly**
Create comprehensive documentation including user manual, API documentation, and deployment guide for future maintenance and enhancement.

### 1.4.3 Learning Objectives

Through this project, the team aims to gain practical experience in:

- Modern web development frameworks and libraries
- RESTful API design and implementation
- Real-time communication protocols
- Database design and optimization
- Authentication and authorization mechanisms
- Progressive Web App development
- Cloud deployment and DevOps practices
- Agile development methodology
- Version control and collaborative development
- Software testing and quality assurance

---

## 1.5 Work Plan

### 1.5.1 Project Phases

The project was divided into six major phases, each with specific deliverables and timelines:

**Phase 1: Planning and Analysis (Weeks 1-2)**
- Requirement gathering and analysis
- Literature review and technology research
- Feasibility study
- Project proposal preparation
- Team role assignment

**Phase 2: Design (Weeks 3-4)**
- System architecture design
- Database schema design
- API endpoint design
- UI/UX wireframing and mockups
- Security architecture planning
- Algorithm design for settlement optimization

**Phase 3: Development - Backend (Weeks 5-6)**
- Development environment setup
- Database implementation
- RESTful API development
- Authentication system implementation
- Real-time communication setup
- Background job scheduling

**Phase 4: Development - Frontend (Weeks 7-8)**
- React application setup
- Component development
- State management implementation
- API integration
- Real-time features integration
- PWA configuration

**Phase 5: Testing and Refinement (Weeks 9-10)**
- Unit testing
- Integration testing
- User acceptance testing
- Performance optimization
- Bug fixes and refinements
- Security audit

**Phase 6: Deployment and Documentation (Weeks 11-12)**
- Production environment setup
- Application deployment
- User manual preparation
- API documentation
- Project report writing
- Presentation preparation

### 1.5.2 Team Organization

The team was organized with the following role distribution:

**Backend Development Team:**
- API development and database management
- Authentication and security implementation
- Real-time communication setup
- Background job implementation

**Frontend Development Team:**
- UI component development
- State management and API integration
- PWA features implementation
- Responsive design implementation

**Testing and Quality Assurance:**
- Test case development
- Testing execution
- Bug tracking and verification
- Performance testing

**Documentation and Deployment:**
- User manual preparation
- API documentation
- Deployment configuration
- Project report compilation

### 1.5.3 Development Methodology

The project followed Agile methodology with:

- **Sprint Duration:** 1 week
- **Daily Standups:** 15-minute sync meetings
- **Sprint Planning:** Beginning of each sprint
- **Sprint Review:** End of each sprint
- **Retrospective:** After each sprint

**Version Control:**
- Git for source code management
- GitHub for repository hosting
- Feature branch workflow
- Pull request reviews before merging

**Communication:**
- Regular team meetings
- Online collaboration tools
- Documentation in shared repository
- Progress tracking through project management tools

### 1.5.4 Risk Management

Potential risks identified and mitigation strategies:

**Technical Risks:**
- Learning curve for new technologies → Allocated time for learning and experimentation
- Integration challenges → Early prototyping and testing
- Performance issues → Regular performance monitoring and optimization

**Project Management Risks:**
- Scope creep → Clear requirement documentation and change control
- Timeline delays → Buffer time in schedule and prioritization of features
- Team coordination → Regular communication and clear role definition

**External Risks:**
- Third-party service dependencies → Fallback mechanisms and error handling
- Deployment issues → Thorough testing in staging environment
- Security vulnerabilities → Security audit and best practices implementation

---

# CHAPTER 2: DESIGN AND METHODOLOGY

## 2.1 Alternative Design Ideas

During the initial design phase, multiple architectural approaches were considered for implementing the expense sharing application. Each approach was evaluated based on technical feasibility, scalability, development complexity, and alignment with project objectives.

### 2.1.1 Idea 1: Monolithic Architecture with Server-Side Rendering

**Description:**
A traditional monolithic application where both frontend and backend are tightly coupled, using server-side rendering with template engines like EJS or Pug. The application would render HTML on the server and send complete pages to the client.

**Key Features:**
- Single codebase for frontend and backend
- Server-side rendering for all pages
- Session-based authentication
- Traditional form submissions
- Minimal JavaScript on client-side

**Advantages:**
- Simpler deployment (single application)
- Better initial page load performance
- Easier SEO optimization
- Reduced client-side complexity

**Disadvantages:**
- Limited interactivity and user experience
- Difficult to implement real-time features
- Tight coupling makes maintenance harder
- Not suitable for mobile app development
- Poor offline capabilities

### 2.1.2 Idea 2: Microservices Architecture with Separate Services

**Description:**
A distributed system where different functionalities (user management, expense tracking, settlements, notifications) are implemented as independent microservices, each with its own database and API.

**Key Features:**
- Separate services for each domain
- Independent deployment and scaling
- Service mesh for inter-service communication
- API gateway for client requests
- Event-driven architecture

**Advantages:**
- High scalability and fault isolation
- Technology flexibility per service
- Independent team development
- Better resource utilization

**Disadvantages:**
- High complexity for project scope
- Requires sophisticated DevOps setup
- Increased latency due to network calls
- Difficult to maintain data consistency
- Overkill for initial version

### 2.1.3 Idea 3: Single Page Application with RESTful API (Selected)

**Description:**
A decoupled architecture with a React-based Single Page Application (SPA) frontend communicating with a Node.js RESTful API backend. Real-time features implemented using WebSocket (Socket.IO). MongoDB for flexible data storage.

**Key Features:**
- Complete separation of frontend and backend
- RESTful API for data operations
- WebSocket for real-time updates
- JWT-based stateless authentication
- Progressive Web App capabilities
- Component-based UI architecture

**Advantages:**
- Rich, interactive user experience
- Easy to implement real-time features
- Clear separation of concerns
- Suitable for PWA development
- Independent frontend and backend development
- Reusable API for future mobile apps
- Better offline capabilities

**Disadvantages:**
- Initial page load may be slower
- Requires more sophisticated state management
- SEO requires additional configuration
- More complex deployment initially

### 2.1.4 Idea 4: Serverless Architecture with Cloud Functions

**Description:**
A serverless approach using cloud functions (AWS Lambda, Google Cloud Functions) for backend logic, with a static frontend hosted on CDN. Database as a service (MongoDB Atlas) and managed authen