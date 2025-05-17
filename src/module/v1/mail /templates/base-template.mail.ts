export const baseTemplate = ({
  title,
  content,
}: {
  title: string;
  content: string;
}) => {
  // update to the original company address
  const address = 'The Company Address';

  return `
  <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <Style>
      body {
  font-family: 'Times New Roman', Georgia;
}

header{
    background-color: #e9f6e9; 
    padding: 20px; 
    text-align: center;
    max-width: 100%;
}
/* CSS for styling the section with a white background and border */
.section1{
    background-color: white;
    border: 1px solid #ddd; 
    padding: 30px; 
    margin: 50px auto; 
    max-width: 600px; 
    box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1); 
    border-radius: 10px; 
}

h1{
    font-size: xx-large;
    color:#191847;
    width: 488px;
    height: 80px;
    text-align: center;
    margin: auto;
}

.section2 {
    width: 145px;
    border: 1px solid #ddd; 
    border-radius: 8px;
    padding: 5px;
    background-color: #fff;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); 
    font-family: Arial, sans-serif;
    text-align: center;
  }
  
  .section2 img:first-of-type {
    width: 129px; 
    height: 121px;
    border-radius: 8px;
    margin-bottom: 2px;
  }
  
  .section2 h3 {
    font-size: 1em;
    color: #202020; 
    margin: 10px 0;
    text-align: left;
  }
  
  .section2 p {
    margin: 5px 0;
    color: #202020; 
    font-size: 1em;
    
  }
  
  .section2 p small {
    font-size: 0.8em;
    color: #646464; 
  }
  
  .section2 img:last-of-type {
    width: 100px;
    height: 10px;
    vertical-align: middle;
    margin-right: 2px;
  }
  
  box {
    background-color: #0047F112;
    display: block;
    margin-top: 15px;
    font-size: 12px;
    color: #002BB7C5; 
    font-weight: bold;
    width: 129px;
    height: 20px;
  }

  button {
    padding: 10px 20px;
    font-size: 1em;
    font-weight: bold;
    color: #fff; 
    background-color: #46A758; 
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: background-color 0.3s ease, transform 0.2s ease;
    margin-top: 5%;
    margin-bottom: 5%;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); 
    width: 488px;
    text-align: center;
  }
  
/* footer*/
footer {
    background-color: #f8f8f8; 
    padding: 20px;
    text-align: left;
    font-family: Arial, sans-serif;
    color: #838383; 
    line-height: 1.6;
    
  }
  
  footer img {
    width: 100px; 
    margin-bottom: 10px;
  }
  
  footer p {
    margin: 5px 0;
  }
  
  footer p b {
    color: #838383; 
    cursor: pointer;
  }
  
  footer hr {
    border: none;
    border-top: 1px solid #838383;
    margin: 15px 0;
  }
  
  footer a {
    text-decoration: none;
    color: #838383;
  }
  
  footer a:hover {
    text-decoration: underline;
    color: #838383; 
  }
  
  @media (max-width: 768px) {
    .section1 {
      padding: 15px;
      margin: 20px auto;
    }
  
    h1 {
      font-size: x-large !important;
      width: auto;
    }
  
    .section2 {
      width: 100%;
      max-width: 100%;
    }
  
    button {
      width: 100%;
    }
  
    footer {
      text-align: center;
    }
  
    footer img {
      margin: auto;
    }
  }
  
  @media (max-width: 480px) {
    header {
      padding: 15px;
    }
  
    h1 {
      font-size: large !important;
    }
  
    .section2 h3 {
      font-size: 0.9em;
    }
  
    .section2 p {
      font-size: 0.9em;
    }
  
    button {
      padding: 8px 16px;
      font-size: 0.9em;
    }
  
    footer p {
      font-size: 0.9em;
    }
  }

  /* Container styling */
.super-container {
  padding: 10px;
  text-align: center;
  background-color: #E9F6E9;
}

.cards-container {
  font-size: 0;
  margin: 0 auto;
}

/* Card styling */
.card {
  display: inline-block;
  vertical-align: top;
  width: 30%;
  margin: 10px 1.5%;
  box-sizing: border-box;
  background-color: #fff;
  padding: 15px;
  border-radius: 8px;
  text-align: left;
  font-size: 16px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

/* Image styling */
.card img {
  width: 100%;
  height: auto;
  margin-bottom: 10px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .card {
    width: 90%; /* Two cards per row on tablets */
  }

  .card img {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .card {
    width: 100%; /* Single card per row on small screens */
  }
}


</Style>
</head>
<body style="background-color:#E9F6E9 ">
    <header >
       
    </header>

    <! -- Main Content Start -->
    <section style="overflow-x: hidden; background-color: #FFFFFF; padding: 20px; border-radius: 10px; font-family: Arial, sans-serif; max-width: 650px; margin: auto; margin-bottom: 30px;">
      ${content}
    </section>
    <!-- Main Content End -->

    <footer>
    
      <p><b>Facebook </b>| <b>Twitter</b> | <b>Instagram</b></p>
      <hr>
      <p>If you have questions or need help, don't hesitate to contact our support team!</p>
      <p>${address}</p>
      <p><b>Terms & conditions</b> |<b> Privacy policy</b> | <b>Contact us</b></p>
    </footer>
</body>
</html>
  `;
};
