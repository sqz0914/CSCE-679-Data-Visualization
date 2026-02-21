# AI Usage
## Interaction Log
Please check the `AI-interaction-log.md` file.
## Reflection
For this assignment, I use ChatGPT to assist me to finish the tasks. To begin, I provided the grading rubrics, the assignment requirements, the example screenshot, and the data file. In the initial response, most of the code works, except that there is not axis and the mouse click to switch between min and max temp is achieved through a text in the title.

To continue, I asked it to show the axis, replace the text click toggle to a button, and remove the titles. It followed my prompt but when it was doing the toggle button, it changed the mouse hovering tips to only show min/max text. Therefore, I continued to ask it to change it back. 

I also noticed that the y axis does not have ticks. So I asked it to add ticks to the y axis. It fixed this issue but at the same time, it made the axis too close to the cells. Therefore, I continued to ask it to fix this issue. After this issue was fixed, I encountered another problem: the x-axis and y-axis are not across at the origin point. So I spent more rounds with ChatGPT to make those two axis come across with each other.

Overall, ChatGPT is very good at creating visualizations using `D3.js` as required. I would say in the very first try, it has finished about 90% of the code. However, there would be some minor issues so I needed to tell it to fix them. One learning is that sometimes, when it was asked to change somewhere, it would also make changes to other places that I did not want it to. Thus, when writing prompt, I needed to be very specific to tell it what to do and what not to do.